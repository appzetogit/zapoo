import Order from "../../order/models/Order.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import Delivery from "../../delivery/models/Delivery.js";
import User from "../../auth/models/User.js";
import CallSession from "../models/CallSession.js";
import { getConfiguredVirtualNumbers } from "../services/numberPoolService.js";
import { generatePassthruXML } from "../services/exotelService.js";

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
      ? Restaurant.findById(order.restaurantId).select(
        "phone primaryContactNumber ownerPhone location onboarding step1"
      )
      : null,
    order?.userId
      ? User.findById(order.userId).select(
        "phone primaryContactNumber phoneNumber mobile"
      )
      : null,
    order?.deliveryPartnerId
      ? Delivery.findById(order.deliveryPartnerId).select("phone")
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
    }).select("_id"),
    User.find({
      $or: [
        { phone: phoneRegex },
        { primaryContactNumber: phoneRegex },
        { phoneNumber: phoneRegex },
        { mobile: phoneRegex },
      ],
    }).select("_id"),
    Delivery.find({ phone: phoneRegex }).select("_id"),
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

    console.log("Passthru incoming call:", {
      CallSid,
      From,
      normalizedFrom,
      To,
      CustomField,
      timestamp,
    });

    const sendDialResponse = (receiverPhone, callerId = incomingVirtualNumber) => {
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
      console.warn("Passthru: no active order matched caller", {
        CallSid,
        From,
        normalizedFrom,
        orderId,
      });
      return sendDialResponse(fallbackPhone);
    }

    if (!ACTIVE_ORDER_STATUSES.has(order.status)) {
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

    return res.status(200).json({
      success: true,
      data: virtualNumbers,
    });
  } catch (error) {
    console.error("Error getting virtual numbers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

