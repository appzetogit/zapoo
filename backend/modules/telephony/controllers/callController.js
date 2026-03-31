import Order from "../../order/models/Order.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import Delivery from "../../delivery/models/Delivery.js";
import User from "../../auth/models/User.js";
import CallSession from "../models/CallSession.js";
import {
  selectVirtualNumberByCity,
  NoVirtualNumberFoundError,
} from "../services/numberPoolService.js";
import { initiateMaskedCall } from "../services/exotelService.js";

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
  }) => ({
    caller_role,
    receiver_role,
    direction,
    fromPhone,
    toPhone,
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
      direction: "restaurant_to_dp",
      fromPhone: restaurantPhone,
      toPhone: deliveryPhone,
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
      direction: "dp_to_restaurant",
      fromPhone: deliveryPhone,
      toPhone: restaurantPhone,
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
      direction: "customer_to_dp",
      fromPhone: customerPhone,
      toPhone: deliveryPhone,
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
      direction: "dp_to_customer",
      fromPhone: deliveryPhone,
      toPhone: customerPhone,
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

    if (order.status === "delivered" || order.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Calls are not allowed for delivered or cancelled orders",
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

    const {
      caller_role,
      receiver_role,
      direction,
      fromPhone,
      toPhone,
      restaurantPhone,
      deliveryPhone,
      customerPhone,
    } = determineRolesAndPhones({
      callerUserId: caller_user_id,
      receiverUserId: receiver_user_id,
      restaurant,
      deliveryPartner,
      customer,
    });

    let virtualNumberDoc;
    try {
      virtualNumberDoc = await selectVirtualNumberByCity({ city });
    } catch (err) {
      if (err instanceof NoVirtualNumberFoundError) {
        return res.status(503).json({
          success: false,
          message: "No virtual numbers available in this city",
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
        caller_user_id,
        receiver_user_id,
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
      return res.status(500).json({
        success: false,
        message: "Failed to initiate call",
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
      payload.CallSid || payload.CallSid || payload.callSid || payload.call_sid;

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
      case "in-progress":
      case "ringing":
        status = "ringing";
        break;
      case "answered":
        status = "answered";
        break;
      case "completed":
      case "success":
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

