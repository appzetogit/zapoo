import Order from "../../order/models/Order.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import Delivery from "../../delivery/models/Delivery.js";
import User from "../../auth/models/User.js";
import CallSession from "../models/CallSession.js";
import { findOrderByIdentifier } from "../../order/utils/findOrderByIdentifier.js";
import { selectVirtualNumberForOrder, getConfiguredVirtualNumbers } from "../services/numberPoolService.js";
import { generatePassthruXML, initiateBridgeCall as initiateExotelBridgeCall } from "../services/exotelService.js";

const TERMINAL_ORDER_STATUSES = new Set([
  "delivered",
  "cancelled",
  "expired",
  "completed",
]);

const ACTIVE_ORDER_STATUSES = new Set([
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
]);

const normalizePhone = (phone) => {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  return digits ? digits.slice(-10) : null;
};

const formatToE164 = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `+91${normalized}`;
};

const buildPhoneRegex = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return new RegExp(`${normalized}$`);
};

const getSupportDialNumber = () => {
  return (
    formatToE164(process.env.EXOTEL_SAFE_NUMBER) ||
    formatToE164(process.env.EXOTEL_SUPPORT_NUMBER) ||
    "+911111111111"
  );
};

const getOrderParticipantPhones = async (order) => {
  const [restaurant, customer, deliveryPartner] = await Promise.all([
    order?.restaurantId
      ? Restaurant.findById(order.restaurantId)
        .select("phone primaryContactNumber ownerPhone location onboarding step1")
        .lean()
      : null,
    order?.userId
      ? User.findById(order.userId)
        .select("phone primaryContactNumber phoneNumber mobile")
        .lean()
      : null,
    order?.deliveryPartnerId
      ? Delivery.findById(order.deliveryPartnerId).select("phone").lean()
      : null,
  ]);

  return {
    restaurant,
    customer,
    deliveryPartner,
    restaurantPhone:
      restaurant?.primaryContactNumber?.trim() ||
      restaurant?.phone?.trim() ||
      restaurant?.ownerPhone?.trim() ||
      "",
    customerPhone:
      customer?.phone?.trim() ||
      customer?.primaryContactNumber?.trim() ||
      customer?.phoneNumber?.trim() ||
      customer?.mobile?.trim() ||
      "",
    deliveryPhone: deliveryPartner?.phone?.trim() || "",
  };
};

const identifyCallerRole = ({ normalizedFrom, restaurantPhone, customerPhone, deliveryPhone }) => {
  if (normalizedFrom && customerPhone && normalizePhone(customerPhone) === normalizedFrom) {
    return "customer";
  }
  if (normalizedFrom && restaurantPhone && normalizePhone(restaurantPhone) === normalizedFrom) {
    return "restaurant";
  }
  if (normalizedFrom && deliveryPhone && normalizePhone(deliveryPhone) === normalizedFrom) {
    return "delivery";
  }
  return "unknown";
};

const findLatestActiveOrderByCallerPhone = async (incomingFromPhone) => {
  const normalizedFrom = normalizePhone(incomingFromPhone);
  if (!normalizedFrom) {
    return null;
  }

  const phoneRegex = buildPhoneRegex(normalizedFrom);
  if (!phoneRegex) {
    return null;
  }

  const [restaurantMatches, customerMatches, deliveryMatches] = await Promise.all([
    Restaurant.find({
      $or: [
        { primaryContactNumber: phoneRegex },
        { phone: phoneRegex },
        { ownerPhone: phoneRegex },
      ],
    }).select("_id").lean(),
    User.find({
      $or: [
        { phone: phoneRegex },
        { primaryContactNumber: phoneRegex },
        { phoneNumber: phoneRegex },
        { mobile: phoneRegex },
      ],
    }).select("_id").lean(),
    Delivery.find({ phone: phoneRegex }).select("_id").lean(),
  ]);

  const orClauses = [];
  if (restaurantMatches.length) {
    orClauses.push({
      restaurantId: { $in: restaurantMatches.map((doc) => String(doc._id)) },
    });
  }
  if (customerMatches.length) {
    orClauses.push({
      userId: { $in: customerMatches.map((doc) => doc._id) },
    });
  }
  if (deliveryMatches.length) {
    orClauses.push({
      deliveryPartnerId: { $in: deliveryMatches.map((doc) => doc._id) },
    });
  }

  if (!orClauses.length) {
    return null;
  }

  return Order.findOne({
    status: { $in: Array.from(ACTIVE_ORDER_STATUSES) },
    $or: orClauses,
  }).sort({ createdAt: -1 });
};

const normalizeCallerRole = (role) => {
  if (!role) return "unknown";
  const normalized = String(role).toLowerCase().trim();
  if (normalized === "user" || normalized === "customer") return "customer";
  if (normalized === "restaurant") return "restaurant";
  if (normalized === "delivery") return "delivery_partner";
  if (normalized === "delivery_partner") return "delivery_partner";
  return "unknown";
};

const normalizeTargetRole = (role) => {
  if (!role) return "unknown";
  const normalized = String(role).toLowerCase().trim();
  if (normalized === "user" || normalized === "customer") return "customer";
  if (normalized === "restaurant") return "restaurant";
  if (normalized === "delivery" || normalized === "delivery_partner") return "delivery_partner";
  return "unknown";
};

const buildBridgeDirection = (callerRole, receiverRole) => {
  return `${callerRole}_to_${receiverRole}`;
};

const debugMaskingFlow = (stage, payload) => {
  console.log(`[MASKING][${stage}]`, payload);
};

const getOrderTelephonyNumber = async (orderDoc) => {
  const existing = orderDoc?.telephony?.virtualNumber;
  if (existing) {
    return formatToE164(existing);
  }

  const selected = selectVirtualNumberForOrder(orderDoc.orderId || orderDoc._id);
  if (!selected) {
    throw new Error("No configured Exotel virtual number available");
  }

  await Order.updateOne(
    { _id: orderDoc._id },
    {
      $set: {
        "telephony.virtualNumber": selected,
        "telephony.virtualNumberAssignedAt": new Date(),
        "telephony.virtualNumberSource": "deterministic_env",
      },
    }
  );

  return selected;
};

const resolveBridgeRecipient = ({
  targetRole,
  restaurant,
  customer,
  deliveryPartner,
  restaurantPhone,
  customerPhone,
  deliveryPhone,
}) => {
  if (targetRole === "restaurant") {
    if (!restaurantPhone) {
      throw new Error("Restaurant phone number not available");
    }
    return {
      receiverRole: "restaurant",
      receiverPhone: formatToE164(restaurantPhone),
      receiverUserId: restaurant?._id ? String(restaurant._id) : null,
    };
  }

  if (targetRole === "customer") {
    if (!customerPhone) {
      throw new Error("Customer phone number not available");
    }
    return {
      receiverRole: "customer",
      receiverPhone: formatToE164(customerPhone),
      receiverUserId: customer?._id ? String(customer._id) : null,
    };
  }

  if (targetRole === "delivery_partner") {
    if (!deliveryPartner) {
      throw new Error("Order does not have an assigned delivery partner");
    }
    if (!deliveryPhone) {
      throw new Error("Delivery partner phone number not available");
    }
    return {
      receiverRole: "delivery_partner",
      receiverPhone: formatToE164(deliveryPhone),
      receiverUserId: deliveryPartner?._id ? String(deliveryPartner._id) : null,
    };
  }

  throw new Error("Invalid target role");
};

const resolveBridgeCaller = ({ reqUser, order, callerRole }) => {
  const callerUserId = reqUser?._id ? String(reqUser._id) : null;
  const orderRestaurantId = order?.restaurantId ? String(order.restaurantId) : null;
  const orderCustomerId = order?.userId ? String(order.userId) : null;
  const orderDeliveryId = order?.deliveryPartnerId
    ? String(order.deliveryPartnerId)
    : order?.assignmentInfo?.deliveryPartnerId
      ? String(order.assignmentInfo.deliveryPartnerId)
      : null;

  if (callerRole === "restaurant") {
    if (!callerUserId || callerUserId !== orderRestaurantId) {
      throw new Error("Caller is not the restaurant for this order");
    }
    return {
      callerRole: "restaurant",
      callerPhone:
        reqUser?.primaryContactNumber ||
        reqUser?.phone ||
        reqUser?.ownerPhone ||
        null,
      callerUserId,
    };
  }

  if (callerRole === "customer") {
    if (!callerUserId || callerUserId !== orderCustomerId) {
      throw new Error("Caller is not the customer for this order");
    }
    return {
      callerRole: "customer",
      callerPhone:
        reqUser?.phone ||
        reqUser?.primaryContactNumber ||
        reqUser?.phoneNumber ||
        reqUser?.mobile ||
        null,
      callerUserId,
    };
  }

  if (callerRole === "delivery_partner") {
    if (!orderDeliveryId) {
      throw new Error("Order does not have an assigned delivery partner");
    }
    if (!callerUserId || callerUserId !== orderDeliveryId) {
      throw new Error("Caller is not the assigned delivery partner for this order");
    }
    return {
      callerRole: "delivery_partner",
      callerPhone: reqUser?.phone || null,
      callerUserId,
    };
  }

  throw new Error("Unsupported caller role");
};

export const initiateBridgeCall = async (req, res) => {
  try {
    const body = req.body || {};
    const orderId = String(body.orderId || body.order_id || "").trim();
    const targetRole = normalizeTargetRole(body.targetRole || body.target_role || body.intent);
    const callerRole = normalizeCallerRole(
      req.restaurant?.role ||
      req.delivery?.role ||
      req.user?.role ||
      req.token?.role
    );

    // Debugging the masked-call entry request from frontend to backend.
    debugMaskingFlow("BRIDGE_REQUEST", {
      orderId,
      targetRole,
      callerRole,
      authRole: req.user?.role || null,
      timestamp: new Date(),
    });

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "orderId is required",
      });
    }

    if (targetRole === "unknown") {
      return res.status(400).json({
        success: false,
        message: "targetRole is required",
      });
    }

    const order = await findOrderByIdentifier(orderId);

    // Debugging order lookup and the resolved order context for bridge initiation.
    debugMaskingFlow("ORDER_LOOKUP", {
      orderId,
      found: Boolean(order),
      matchedOrderId: order?.orderId || order?._id || null,
      status: order?.status || null,
      restaurantId: order?.restaurantId || null,
      userId: order?.userId || null,
      deliveryPartnerId: order?.deliveryPartnerId || order?.assignmentInfo?.deliveryPartnerId || null,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (TERMINAL_ORDER_STATUSES.has(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Calls are not allowed for terminal orders",
      });
    }

    const reqUser = req.restaurant || req.delivery || req.user;
    const caller = resolveBridgeCaller({ reqUser, order, callerRole });
    const participants = await getOrderParticipantPhones(order);
    const recipient = resolveBridgeRecipient({
      targetRole,
      ...participants,
    });

    if (caller.callerRole === recipient.receiverRole) {
      return res.status(400).json({
        success: false,
        message: "Caller and receiver roles cannot be the same",
      });
    }

    // Debugging final caller/receiver resolution before Exotel bridge request.
    debugMaskingFlow("ROUTE_RESOLUTION", {
      orderId,
      callerRole: caller.callerRole,
      callerUserId: caller.callerUserId,
      callerPhone: caller.callerPhone,
      receiverRole: recipient.receiverRole,
      receiverUserId: recipient.receiverUserId,
      receiverPhone: recipient.receiverPhone,
      direction: buildBridgeDirection(caller.callerRole, recipient.receiverRole),
    });

    const bridgeNumber = await getOrderTelephonyNumber(order);
    const bridgeNumberE164 = formatToE164(bridgeNumber);
    const callerPhone = formatToE164(caller.callerPhone);

    if (!bridgeNumberE164) {
      return res.status(500).json({
        success: false,
        message: "No configured Exotel virtual number available",
      });
    }

    if (!callerPhone || !recipient.receiverPhone) {
      return res.status(400).json({
        success: false,
        message: "Valid caller and receiver phone numbers are required",
      });
    }

    const direction = buildBridgeDirection(caller.callerRole, recipient.receiverRole);

    // Debugging the exact Exotel bridge request payload before it is sent.
    debugMaskingFlow("EXOTEL_BRIDGE_REQUEST", {
      orderId,
      fromPhone: callerPhone,
      toPhone: recipient.receiverPhone,
      virtualNumber: bridgeNumberE164,
      direction,
      exotelBaseUrl: process.env.EXOTEL_SUBDOMAIN || "api",
    });

    const exotelResponse = await initiateExotelBridgeCall({
      fromPhone: callerPhone,
      toPhone: recipient.receiverPhone,
      virtualNumber: bridgeNumberE164,
      orderId,
    });

    // Debugging Exotel response to confirm call SID creation and API success.
    debugMaskingFlow("EXOTEL_BRIDGE_RESPONSE", {
      orderId,
      callSid: exotelResponse.callSid,
      raw: exotelResponse.raw,
    });

    let session = null;
    try {
      session = await CallSession.create({
        order_id: orderId,
        caller_user_id: caller.callerUserId,
        receiver_user_id: recipient.receiverUserId,
        caller_role: caller.callerRole,
        receiver_role: recipient.receiverRole,
        virtual_number: bridgeNumberE164,
        restaurant_phone: participants.restaurantPhone || null,
        delivery_partner_phone: participants.deliveryPhone || null,
        customer_phone: participants.customerPhone || null,
        caller_phone: callerPhone,
        receiver_phone: recipient.receiverPhone,
        call_sid: exotelResponse.callSid,
        status: "initiated",
        direction,
        call_type: "outbound_bridge",
        incoming_caller_id_displayed: bridgeNumberE164,
      });
    } catch (sessionError) {
      console.error("Bridge session logging failed:", sessionError);
    }

    // Debugging the call-session record written after Exotel accepts the bridge request.
    debugMaskingFlow("SESSION_CREATED", {
      orderId,
      callSid: exotelResponse.callSid,
      sessionId: session?._id ? String(session._id) : null,
      status: session?.status || "initiated",
      direction,
      virtualNumber: bridgeNumberE164,
    });

    try {
      await Order.updateOne(
        { _id: order._id },
        {
          $set: {
            "telephony.lastBridgeCallAt": new Date(),
            "telephony.lastBridgeCallSid": exotelResponse.callSid,
          },
        }
      );
    } catch (orderUpdateError) {
      console.error("Bridge order metadata update failed:", orderUpdateError);
    }

    // Debugging the order metadata update that stores bridge tracking fields.
    debugMaskingFlow("ORDER_UPDATED", {
      orderId,
      callSid: exotelResponse.callSid,
      lastBridgeCallAt: new Date(),
      virtualNumber: bridgeNumberE164,
    });

    // Debugging the final bridge session summary after persistence.
    console.log("[BRIDGE]", {
      orderId,
      targetRole,
      callerRole: caller.callerRole,
      receiverRole: recipient.receiverRole,
      callSid: exotelResponse.callSid,
      virtualNumber: bridgeNumberE164,
      timestamp: new Date(),
    });

    // Debugging the exact JSON response returned to the frontend after bridge initiation.
    debugMaskingFlow("BRIDGE_RESPONSE", {
      success: true,
      data: {
        callSid: session?.call_sid || exotelResponse.callSid,
        orderId,
        direction,
      },
      timestamp: new Date(),
    });

    return res.status(201).json({
      success: true,
      data: {
        callSid: session?.call_sid || exotelResponse.callSid,
        orderId,
        direction,
      },
    });
  } catch (error) {
    // Debugging any bridge-initiation failure before the API responds to the frontend.
    debugMaskingFlow("BRIDGE_ERROR", {
      message: error?.message || "Failed to initiate bridge call",
      name: error?.name || null,
      code: error?.code || null,
      timestamp: new Date(),
    });
    console.error("Bridge call initiation failed:", error);

    // Graceful business error: masking is not configured, so caller can retry later.
    if (error?.code === "NO_VIRTUAL_NUMBER") {
      return res.status(409).json({
        success: false,
        code: "MASKING_UNAVAILABLE",
        message: "Calling is currently unavailable. Please try again shortly.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to initiate bridge call",
    });
  }
};

export const handleExotelCallback = async (req, res) => {
  try {
    const payload = req.body || {};
    const callSid =
      payload.CallSid || payload.callSid || payload.call_sid;

    if (!callSid) {
      return res.status(400).json({
        success: false,
        message: "Missing CallSid in callback",
      });
    }

    const session = await CallSession.findOne({ call_sid: callSid });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Call session not found",
      });
    }

    const exotelStatus = payload.Status || payload.CallStatus || "";
    let status = session.status;

    switch (exotelStatus.toLowerCase()) {
      case "initiated":
      case "queued":
        status = "initiated";
        break;
      case "in-progress":
      case "ringing":
        status = "ringing";
        break;
      case "answered":
        status = "answered";
        break;
      case "completed":
      case "success":
      case "terminal":
        status = "completed";
        break;
      case "busy":
        status = "busy";
        break;
      case "no-answer":
      case "no_answer":
        status = "no_answer";
        break;
      case "failed":
      case "error":
        status = "failed";
        break;
      case "cancelled":
      case "canceled":
        status = "cancelled";
        break;
      default:
        status = session.status;
    }

    const duration = payload.CallDuration
      ? Number(payload.CallDuration)
      : session.duration;
    const cost = payload.TotalAmount
      ? Number(payload.TotalAmount)
      : session.cost;

    const isTerminalEvent =
      (payload.StatusType && payload.StatusType.toLowerCase() === "terminal") ||
      (payload.Event && payload.Event.toLowerCase() === "terminal");

    // Debugging Exotel callback status updates and terminal event handling.
    debugMaskingFlow("EXOTEL_CALLBACK", {
      callSid,
      orderId: session.order_id,
      previousStatus: session.status,
      incomingStatus: exotelStatus,
      mappedStatus: status,
      duration,
      cost,
      isTerminalEvent,
      rawPayload: payload,
    });

    const update = {
      status,
      duration,
      cost,
      raw_webhook_payload: payload,
    };

    if (isTerminalEvent) {
      update.ended_at = new Date();
    }

    await CallSession.updateOne({ _id: session._id }, { $set: update });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Passthru handler for incoming calls via Exotel
 * Receives incoming call, routes to appropriate recipient
 * Responds with XML dial instructions
 * 
 * Exotel sends: From, CallType, CallSid, CustomField (orderId), etc.
 */
export const handleIncomingCallPassthru = async (req, res) => {
  try {
    const params = req.method === "GET" ? req.query : req.body || {};
    const { From, To, CallSid, CustomField } = params;
    const normalizedFrom = normalizePhone(From);
    const incomingVirtualNumber =
      formatToE164(To) ||
      formatToE164(process.env.EXOTEL_VIRTUAL_NUMBER) ||
      getSupportDialNumber();
    const fallbackPhone = getSupportDialNumber();
    const timestamp = new Date();

    console.log("[PASSTHRU]", {
      CallSid,
      From,
      normalizedFrom,
      To,
      CustomField,
      timestamp,
    });

    const sendDialResponse = (receiverPhone, callerId = incomingVirtualNumber) => {
      // Debugging the final XML response sent back to Exotel for passthru routing.
      debugMaskingFlow("PASSTHRU_XML_RESPONSE", {
        CallSid,
        receiverPhone,
        callerId,
        fallbackPhone,
        timestamp: new Date(),
      });
      return res
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(
          generatePassthruXML({
            toPhone: receiverPhone,
            callerId,
            fallbackPhone,
          })
        );
    };

    if (!From || !CallSid) {
      console.warn("Passthru: missing required params", {
        From,
        CallSid,
        CustomField,
      });
      return sendDialResponse(fallbackPhone);
    }

    const orderId = CustomField ? String(CustomField).trim() : "";
    let order = null;

    if (orderId) {
      order = await Order.findOne({ orderId });
    }

    if (!order) {
      order = await findLatestActiveOrderByCallerPhone(From);
    }

    if (!order) {
      // Debugging passthru fallback when no order is matched from orderId or caller phone.
      debugMaskingFlow("PASSTHRU_NO_ORDER", {
        CallSid,
        From,
        normalizedFrom,
        orderId,
        fallbackPhone,
      });
      console.warn("Passthru: no active order matched caller", {
        CallSid,
        From,
        normalizedFrom,
        orderId,
      });
      return sendDialResponse(fallbackPhone);
    }

    if (!ACTIVE_ORDER_STATUSES.has(order.status)) {
      // Debugging passthru rejection when the order is in a terminal or inactive state.
      debugMaskingFlow("PASSTHRU_INACTIVE_ORDER", {
        CallSid,
        orderId: order.orderId,
        status: order.status,
        From,
        fallbackPhone,
      });
      console.warn("Passthru: order is not active", {
        orderId: order.orderId,
        status: order.status,
        CallSid,
        From,
      });
      return sendDialResponse(fallbackPhone);
    }

    const {
      restaurant,
      customer,
      deliveryPartner,
      restaurantPhone,
      customerPhone,
      deliveryPhone,
    } = await getOrderParticipantPhones(order);


    const role = identifyCallerRole({
      normalizedFrom,
      restaurantPhone,
      customerPhone,
      deliveryPhone,
    });

    // Debugging passthru caller-role detection from the incoming Exotel number.
    debugMaskingFlow("PASSTHRU_ROLE_DETECTION", {
      CallSid,
      From,
      normalizedFrom,
      orderId: order.orderId,
      detectedRole: role,
      restaurantPhone,
      customerPhone,
      deliveryPhone,
    });

    let receiverPhone = fallbackPhone;
    let receiverRole = "unknown";
    let callType = "other";

    if (role === "customer") {
      if (deliveryPhone) {
        receiverPhone = formatToE164(deliveryPhone) || fallbackPhone;
        receiverRole = "delivery_partner";
        callType = "customer_to_delivery_partner";
      } else if (restaurantPhone) {
        receiverPhone = formatToE164(restaurantPhone) || fallbackPhone;
        receiverRole = "restaurant";
        callType = "customer_to_restaurant";
      }
    } else if (role === "restaurant") {
      if (deliveryPhone) {
        receiverPhone = formatToE164(deliveryPhone) || fallbackPhone;
        receiverRole = "delivery_partner";
        callType = "restaurant_to_delivery_partner";
      } else if (customerPhone) {
        receiverPhone = formatToE164(customerPhone) || fallbackPhone;
        receiverRole = "customer";
        callType = "restaurant_to_customer";
      }
    } else if (role === "delivery") {
      if (customerPhone) {
        receiverPhone = formatToE164(customerPhone) || fallbackPhone;
        receiverRole = "customer";
        callType = "delivery_partner_to_customer";
      } else if (restaurantPhone) {
        receiverPhone = formatToE164(restaurantPhone) || fallbackPhone;
        receiverRole = "restaurant";
        callType = "delivery_partner_to_restaurant";
      }
    } else {
      receiverPhone = fallbackPhone;
      receiverRole = "unknown";
      callType = "other";
    }

    if (!receiverPhone) {
      receiverPhone = fallbackPhone;
    }

    // Debugging passthru routing decision before the XML is generated.
    debugMaskingFlow("PASSTHRU_ROUTE", {
      CallSid,
      orderId: order.orderId,
      callerRole: role,
      receiverRole,
      receiverPhone,
      callType,
      fallbackPhone,
    });

    const callerPhone = formatToE164(From) || From;
    const callerUserId =
      role === "restaurant"
        ? restaurant?._id ? String(restaurant._id) : null
        : role === "customer"
          ? customer?._id ? String(customer._id) : null
          : role === "delivery"
            ? deliveryPartner?._id ? String(deliveryPartner._id) : null
            : null;
    const receiverUserId =
      receiverRole === "restaurant"
        ? restaurant?._id ? String(restaurant._id) : null
        : receiverRole === "customer"
          ? customer?._id ? String(customer._id) : null
          : receiverRole === "delivery_partner"
            ? deliveryPartner?._id ? String(deliveryPartner._id) : null
            : null;

    console.log({
      CallSid,
      From,
      normalizedFrom,
      role,
      orderId: order.orderId,
      receiverPhone,
      timestamp: new Date(),
    });

    void CallSession.create({
      order_id: order.orderId || String(order._id),
      caller_user_id: callerUserId,
      receiver_user_id: receiverUserId,
      call_sid: CallSid,
      caller_phone: callerPhone,
      receiver_phone: receiverPhone,
      caller_role: role,
      receiver_role: receiverRole,
      virtual_number: incomingVirtualNumber,
      direction: callType,
      status: "ringing",
      call_type: "inbound_passthru",
      incoming_from: From,
      incoming_caller_id_displayed: incomingVirtualNumber,
      routing_lookup_status: role === "unknown" ? "failed_access_denied" : "resolved",
      started_at: new Date(),
    }).catch((err) => {
      console.error("Passthru: background call session logging failed:", err);
    });

    return sendDialResponse(receiverPhone);
  } catch (error) {
    console.error("Passthru handler error:", error);
    return res
      .set("Content-Type", "text/xml; charset=utf-8")
      .send(
        generatePassthruXML({
          toPhone: getSupportDialNumber(),
          callerId: formatToE164(process.env.EXOTEL_VIRTUAL_NUMBER) || getSupportDialNumber(),
          fallbackPhone: getSupportDialNumber(),
        })
      );
  }
};

/**
 * Get virtual numbers for frontend
 * Returns the configured virtual numbers for different call types
 */
export const getVirtualNumbers = async (req, res) => {
  try {
    const configuredNumbers = getConfiguredVirtualNumbers();
    const sharedNumber = configuredNumbers[0] || null;

    const virtualNumbers = {
      restaurant_call: sharedNumber,
      customer_call: sharedNumber,
      delivery_partner_call: sharedNumber,
      customer_delivery_call: sharedNumber,
      city: process.env.EXOTEL_VIRTUAL_CITY || null,
      all: configuredNumbers,
    };

    // Debugging the virtual-number response sent to the frontend for masking configuration.
    debugMaskingFlow("VIRTUAL_NUMBERS", {
      sharedNumber,
      city: process.env.EXOTEL_VIRTUAL_CITY || null,
      totalConfiguredNumbers: configuredNumbers.length,
      timestamp: new Date(),
    });

    return res.status(200).json({
      success: true,
      data: virtualNumbers,
    });
  } catch (error) {
    if (error?.code === "NO_VIRTUAL_NUMBER") {
      return res.status(200).json({
        success: false,
        code: "MASKING_UNAVAILABLE",
        message: "Calling is currently unavailable.",
        data: {
          restaurant_call: null,
          customer_call: null,
          delivery_partner_call: null,
          customer_delivery_call: null,
          city: process.env.EXOTEL_VIRTUAL_CITY || null,
          all: [],
        },
      });
    }
    console.error("Error getting virtual numbers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
