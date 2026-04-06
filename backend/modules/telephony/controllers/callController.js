import Order from "../../order/models/Order.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import Delivery from "../../delivery/models/Delivery.js";
import User from "../../auth/models/User.js";
import CallSession from "../models/CallSession.js";
import {
  getConfiguredVirtualNumbers,
  selectVirtualNumberByCity,
  NoVirtualNumberFoundError,
} from "../services/numberPoolService.js";
import {
  generateHangupXML,
  generatePassthruXML,
  initiateMaskedCall,
} from "../services/exotelService.js";

const TERMINAL_ORDER_STATUSES = new Set([
  "delivered",
  "cancelled",
  "expired",
  "completed",
]);

const validateCallRequest = (body) => {
  const errors = [];
  if (!body.order_id || typeof body.order_id !== "string") {
    errors.push("order_id is required and must be a string");
  }
  if (!body.caller_user_id || typeof body.caller_user_id !== "string") {
    errors.push("caller_user_id is required and must be a string");
  }
  if (!body.receiver_user_id || typeof body.receiver_user_id !== "string") {
    errors.push("receiver_user_id is required and must be a string");
  }
  return errors;
};

const resolveCityForOrder = (order, restaurant) => {
  if (order?.address?.city) {
    return order.address.city;
  }
  if (restaurant?.location?.city) {
    return restaurant.location.city;
  }
  if (restaurant?.onboarding?.step1?.location?.city) {
    return restaurant.onboarding.step1.location.city;
  }
  return null;
};

const determineRolesAndPhones = ({
  callerUserId,
  receiverUserId,
  restaurant,
  deliveryPartner,
  customer,
}) => {
  const restaurantPhone =
    restaurant?.primaryContactNumber?.trim() ||
    restaurant?.phone?.trim() ||
    restaurant?.ownerPhone?.trim() ||
    "";
  const deliveryPhone = deliveryPartner?.phone?.trim() || "";
  const customerPhone =
    customer?.phone?.trim() ||
    customer?.primaryContactNumber?.trim() ||
    customer?.phoneNumber?.trim() ||
    customer?.mobile?.trim() ||
    "";

  const restaurantId = restaurant ? String(restaurant._id) : null;
  const customerId = customer ? String(customer._id) : null;
  const deliveryId = deliveryPartner ? String(deliveryPartner._id) : null;

  if (!restaurantPhone) {
    throw new Error("Missing restaurant phone number");
  }

  const buildResult = ({
    caller_role,
    receiver_role,
    direction,
    fromPhone,
    toPhone,
    callerUserId: selectedCallerUserId,
    receiverUserId: selectedReceiverUserId,
  }) => ({
    caller_role,
    receiver_role,
    direction,
    fromPhone,
    toPhone,
    callerUserId: selectedCallerUserId,
    receiverUserId: selectedReceiverUserId,
    restaurantPhone,
    deliveryPhone,
    customerPhone,
  });

  if (callerUserId === restaurantId && receiverUserId === deliveryId) {
    if (!deliveryPartner) {
      throw new Error("Order does not have an assigned delivery partner");
    }
    if (!deliveryPhone) {
      throw new Error("Missing delivery partner phone number");
    }
    return buildResult({
      caller_role: "restaurant",
      receiver_role: "delivery_partner",
      direction: "restaurant_to_delivery_partner",
      fromPhone: restaurantPhone,
      toPhone: deliveryPhone,
      callerUserId: restaurantId,
      receiverUserId: deliveryId,
    });
  }

  if (callerUserId === deliveryId && receiverUserId === restaurantId) {
    if (!deliveryPartner) {
      throw new Error("Order does not have an assigned delivery partner");
    }
    if (!deliveryPhone) {
      throw new Error("Missing delivery partner phone number");
    }
    return buildResult({
      caller_role: "delivery_partner",
      receiver_role: "restaurant",
      direction: "delivery_partner_to_restaurant",
      fromPhone: deliveryPhone,
      toPhone: restaurantPhone,
      callerUserId: deliveryId,
      receiverUserId: restaurantId,
    });
  }

  if (callerUserId === restaurantId && receiverUserId === customerId) {
    if (!customerPhone) {
      throw new Error("Missing customer phone number");
    }
    return buildResult({
      caller_role: "restaurant",
      receiver_role: "customer",
      direction: "restaurant_to_customer",
      fromPhone: restaurantPhone,
      toPhone: customerPhone,
      callerUserId: restaurantId,
      receiverUserId: customerId,
    });
  }

  if (callerUserId === customerId && receiverUserId === restaurantId) {
    if (!customerPhone) {
      throw new Error("Missing customer phone number");
    }
    return buildResult({
      caller_role: "customer",
      receiver_role: "restaurant",
      direction: "customer_to_restaurant",
      fromPhone: customerPhone,
      toPhone: restaurantPhone,
      callerUserId: customerId,
      receiverUserId: restaurantId,
    });
  }

  if (callerUserId === customerId && receiverUserId === deliveryId) {
    if (!deliveryPartner) {
      throw new Error("Order does not have an assigned delivery partner");
    }
    if (!customerPhone) {
      throw new Error("Missing customer phone number");
    }
    if (!deliveryPhone) {
      throw new Error("Missing delivery partner phone number");
    }
    return buildResult({
      caller_role: "customer",
      receiver_role: "delivery_partner",
      direction: "customer_to_delivery_partner",
      fromPhone: customerPhone,
      toPhone: deliveryPhone,
      callerUserId: customerId,
      receiverUserId: deliveryId,
    });
  }

  if (callerUserId === deliveryId && receiverUserId === customerId) {
    if (!deliveryPartner) {
      throw new Error("Order does not have an assigned delivery partner");
    }
    if (!deliveryPhone) {
      throw new Error("Missing delivery partner phone number");
    }
    if (!customerPhone) {
      throw new Error("Missing customer phone number");
    }
    return buildResult({
      caller_role: "delivery_partner",
      receiver_role: "customer",
      direction: "delivery_partner_to_customer",
      fromPhone: deliveryPhone,
      toPhone: customerPhone,
      callerUserId: deliveryId,
      receiverUserId: customerId,
    });
  }

  throw new Error("Unsupported caller/receiver combination for this order");
};

export const initiateCall = async (req, res) => {
  try {
    const errors = validateCallRequest(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }

    const { order_id, caller_user_id, receiver_user_id } = req.body;

    const order = await Order.findOne({ orderId: order_id });
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (TERMINAL_ORDER_STATUSES.has(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Calls are not allowed for terminal orders",
      });
    }

    const restaurant = await Restaurant.findById(order.restaurantId);
    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    if (!order.userId) {
      return res.status(400).json({
        success: false,
        message: "Order does not have an assigned customer",
      });
    }

    const customer = await User.findById(order.userId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    let deliveryPartner = null;
    if (order.deliveryPartnerId) {
      deliveryPartner = await Delivery.findById(order.deliveryPartnerId);
      if (!deliveryPartner) {
        return res.status(404).json({
          success: false,
          message: "Delivery partner not found",
        });
      }
    }

    const city = resolveCityForOrder(order, restaurant);
    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City information is missing for this order",
      });
    }

    let rolePlan;
    try {
      rolePlan = determineRolesAndPhones({
        callerUserId: caller_user_id,
        receiverUserId: receiver_user_id,
        restaurant,
        deliveryPartner,
        customer,
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    const {
      caller_role,
      receiver_role,
      direction,
      fromPhone,
      toPhone,
      callerUserId,
      receiverUserId,
      restaurantPhone,
      deliveryPhone,
      customerPhone,
    } = rolePlan;

    let virtualNumberDoc;
    try {
      virtualNumberDoc = await selectVirtualNumberByCity({
        city,
        stableKey: order.orderId,
      });
    } catch (err) {
      if (err instanceof NoVirtualNumberFoundError) {
        return res.status(503).json({
          success: false,
          message: "No virtual numbers configured",
        });
      }
      throw err;
    }

    try {
      const { callSid } = await initiateMaskedCall({
        fromPhone,
        toPhone,
        virtualNumber: virtualNumberDoc.number,
        orderId: order.orderId,
      });

      const session = await CallSession.create({
        order_id: order.orderId,
        caller_user_id: callerUserId,
        receiver_user_id: receiverUserId,
        caller_role,
        receiver_role,
        virtual_number: virtualNumberDoc.number,
        restaurant_phone: restaurantPhone,
        delivery_partner_phone: deliveryPhone || null,
        customer_phone: customerPhone || null,
        caller_phone: fromPhone,
        receiver_phone: toPhone,
        call_sid: callSid,
        status: "initiated",
        direction,
        call_type: "outbound_api",
        incoming_caller_id_displayed: virtualNumberDoc.number,
      });

      return res.status(201).json({
        success: true,
        data: {
          call_sid: session.call_sid,
          virtual_number: session.virtual_number,
          direction: session.direction,
        },
      });
    } catch (err) {
      console.error("Telephony call initiation failed:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to initiate call",
        error: process.env.NODE_ENV !== "production" ? err.message : undefined,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
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
    const { From, CustomField, CallSid, CallType, To, Called } = params;
    const calledNumberRaw = To || Called || params.to || params.called || "";
    const incomingVirtualNumber = String(calledNumberRaw || process.env.EXOTEL_VIRTUAL_NUMBER || "").trim();

    // Log incoming CallSid and From number
    console.log("Exotel Passthru - Incoming CallSid:", CallSid, "From:", From);

    console.log("Passthru incoming call:", {
      method: req.method,
      params: {
        From,
        CustomField,
        CallSid,
        To: incomingVirtualNumber,
      },
    });

    // Edge case: Missing required fields
    if (!From || !CallSid) {
      console.warn("Passthru: Missing required Exotel parameters", {
        From,
        CustomField,
        CallSid,
      });
      return res
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(generateHangupXML("missing_parameters"));
    }

    const orderId = CustomField ? String(CustomField).trim() : "";
    const incomingFromPhone = String(From).trim();

    // Import routing service dynamically
    const {
      routeIncomingCall,
      validateCallSafety,
      findOrderByCallerPhone,
    } = await import("../services/callRoutingService.js");

    // Resolve order by custom field or caller phone
    let order = null;
    if (orderId) {
      order = await Order.findOne({ orderId });
    }

    if (!order) {
      const phoneLookup = await findOrderByCallerPhone(incomingFromPhone);
      if (phoneLookup?.order) {
        order = phoneLookup.order;
      }
    }

    if (!order) {
      console.warn("Passthru: No order found for incoming call", {
        incomingFromPhone,
        orderId,
        CallSid,
      });
      return res
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(generateHangupXML("order_not_found"));
    }

    const safetyCheck = await validateCallSafety({
      order,
      incomingFromPhone,
    });

    if (!safetyCheck.safe) {
      console.warn(`Passthru: Call safety check failed: ${safetyCheck.reason}`, {
        orderId: order.orderId,
        incomingFromPhone,
      });

      try {
        await CallSession.create({
          order_id: order.orderId,
          call_sid: CallSid,
          caller_phone: incomingFromPhone,
          receiver_phone: "unknown",
          caller_role: "unknown",
          receiver_role: "unknown",
          virtual_number: "passthru_incoming",
          direction: "other",
          status: "failed",
          call_type: "inbound_passthru",
          incoming_from: incomingFromPhone,
          routing_lookup_status: "failed_access_denied",
          routing_error: safetyCheck.reason,
        });
      } catch (logErr) {
        console.error("Failed to log rejected call:", logErr);
      }

      return res
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(generateHangupXML("unauthorized"));
    }

    // Route the call
    const routingResult = await routeIncomingCall({
      incomingFromPhone,
      incomingVirtualNumber,
      order,
    });

    if (!routingResult.success) {
      console.warn("Passthru: Routing failed", {
        orderId,
        incomingFromPhone,
        error: routingResult.errorCode,
      });

      // Log the routing failure
      try {
        const mappedStatus = {
          invalid_params: "failed_unknown",
          invalid_phone_format: "failed_unknown",
          order_not_found: "failed_order_not_active",
          order_not_active: "failed_order_not_active",
          unauthorized_caller: "failed_access_denied",
          no_recipient_found: "failed_recipient_not_found",
          restaurant_not_found: "failed_unknown",
          customer_not_found: "failed_unknown",
          delivery_partner_not_found: "failed_unknown",
          internal_error: "failed_unknown",
        }[routingResult.errorCode] || "failed_unknown";

        await CallSession.create({
          order_id: order.orderId || String(order._id),
          call_sid: CallSid,
          caller_phone: incomingFromPhone,
          receiver_phone: "unknown",
          caller_role: "unknown",
          receiver_role: "unknown",
          virtual_number: "passthru_incoming",
          direction: "other",
          status: "failed",
          call_type: "inbound_passthru",
          incoming_from: incomingFromPhone,
          routing_lookup_status: mappedStatus,
          routing_error: routingResult.error,
        });
      } catch (logErr) {
        console.error("Failed to log routing failure:", logErr);
      }

      return res
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(generateHangupXML("routing_failed"));
    }

    // Recipient found - create call session
    try {
      const callSession = await CallSession.create({
        order_id: order.orderId || String(order._id),
        caller_user_id: routingResult.callerUserId || null,
        receiver_user_id: routingResult.receiverUserId || null,
        call_sid: CallSid,
        caller_phone: incomingFromPhone,
        receiver_phone: routingResult.receiverPhone || routingResult.recipientPhone,
        caller_role: routingResult.callerRole,
        receiver_role: routingResult.recipientRole,
        virtual_number: incomingVirtualNumber || process.env.EXOTEL_VIRTUAL_NUMBER || "passthru_incoming",
        direction: routingResult.callType,
        status: "ringing",
        call_type: "inbound_passthru",
        incoming_from: incomingFromPhone,
        incoming_caller_id_displayed: incomingVirtualNumber || process.env.EXOTEL_VIRTUAL_NUMBER || null,
        routing_lookup_status: "resolved",
        started_at: new Date(),
      });

      console.log("Passthru: Call routed successfully", {
        callSessionId: callSession._id,
        callType: routingResult.callType,
        to: routingResult.recipientPhone,
      });

      // Response with dial XML to Exotel
      return res
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(
          generatePassthruXML({
            toPhone: routingResult.receiverPhone || routingResult.recipientPhone,
            callerId: incomingVirtualNumber || process.env.EXOTEL_VIRTUAL_NUMBER,
          })
        );
    } catch (sessionErr) {
      console.error("Passthru: Failed to create call session:", sessionErr);
      return res
        .set("Content-Type", "text/xml; charset=utf-8")
        .send(generateHangupXML("system_error"));
    }
  } catch (error) {
    console.error("Passthru handler error:", error);
    return res
      .set("Content-Type", "text/xml; charset=utf-8")
      .send(generateHangupXML("handler_error"));
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

