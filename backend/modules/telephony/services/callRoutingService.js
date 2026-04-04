import Order from "../../order/models/Order.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import Delivery from "../../delivery/models/Delivery.js";
import User from "../../auth/models/User.js";

const normalizePhone = (phone) => {
  if (!phone) return null;
  return String(phone).replace(/[\s\-+]/g, "").slice(-10);
};

const phonesMatch = (phone1, phone2) => {
  return normalizePhone(phone1) === normalizePhone(phone2);
};

/**
 * Route incoming call based on caller and virtual number
 * Edge cases handled:
 * - Invalid phone formats
 * - Order not found
 * - Order inactive/completed/cancelled
 * - Caller not associated with order
 * - Missing recipient data
 */
export const routeIncomingCall = async ({
  incomingFromPhone,
  incomingVirtualNumber,
  orderId,
}) => {
  const result = {
    success: false,
    recipientPhone: null,
    callType: null,
    callerRole: null,
    recipientRole: null,
    error: null,
    errorCode: null,
    metadata: {},
  };

  try {
    // Validation
    if (!incomingFromPhone || !incomingVirtualNumber || !orderId) {
      result.error = "Missing required parameters";
      result.errorCode = "invalid_params";
      return result;
    }

    const normalizedFromPhone = normalizePhone(incomingFromPhone);
    if (!normalizedFromPhone || normalizedFromPhone.length < 10) {
      result.error = "Invalid incoming phone number format";
      result.errorCode = "invalid_phone_format";
      return result;
    }

    // Find order
    const order = await Order.findOne({ orderId });
    if (!order) {
      result.error = "Order not found";
      result.errorCode = "order_not_found";
      return result;
    }

    // Check order status
    if (["completed", "cancelled", "expired"].includes(order.status)) {
      result.error = `Cannot route call for ${order.status} order`;
      result.errorCode = "order_not_active";
      return result;
    }

    // Fetch related entities
    const restaurant = await Restaurant.findById(order.restaurantId);
    if (!restaurant) {
      result.error = "Restaurant not found";
      result.errorCode = "restaurant_not_found";
      return result;
    }

    const customer = await User.findById(order.userId);
    if (!customer) {
      result.error = "Customer not found";
      result.errorCode = "customer_not_found";
      return result;
    }

    let deliveryPartner = null;
    if (order.deliveryPartnerId) {
      deliveryPartner = await Delivery.findById(order.deliveryPartnerId);
      if (!deliveryPartner) {
        result.error = "Delivery partner not found";
        result.errorCode = "delivery_partner_not_found";
        return result;
      }
    }

    // Extract phone numbers with fallbacks
    const restaurantPhone = (
      restaurant?.primaryContactNumber ||
      restaurant?.phone ||
      restaurant?.ownerPhone ||
      ""
    ).trim();

    const deliveryPhone = (deliveryPartner?.phone || "").trim();

    const customerPhone = (
      customer?.phone ||
      customer?.primaryContactNumber ||
      customer?.phoneNumber ||
      customer?.mobile ||
      ""
    ).trim();

    // Route logic: Determine who is calling and who to route to
    if (phonesMatch(normalizedFromPhone, restaurantPhone)) {
      // Restaurant is calling - route to recipient based on context

      // Try delivery partner first if available
      if (deliveryPartner && deliveryPhone) {
        result.recipientPhone = deliveryPhone;
        result.callType = "restaurant_to_delivery_partner";
        result.callerRole = "restaurant";
        result.recipientRole = "delivery_partner";
        result.success = true;
        return result;
      }

      // Fall back to customer
      if (customerPhone) {
        result.recipientPhone = customerPhone;
        result.callType = "restaurant_to_customer";
        result.callerRole = "restaurant";
        result.recipientRole = "customer";
        result.success = true;
        return result;
      }

      result.error = "No valid recipient found for restaurant";
      result.errorCode = "no_recipient_found";
      return result;
    }

    if (deliveryPhone && phonesMatch(normalizedFromPhone, deliveryPhone)) {
      // Delivery partner is calling

      // Prefer customer if available
      if (customerPhone) {
        result.recipientPhone = customerPhone;
        result.callType = "delivery_partner_to_customer";
        result.callerRole = "delivery_partner";
        result.recipientRole = "customer";
        result.success = true;
        return result;
      }

      // Fall back to restaurant
      if (restaurantPhone) {
        result.recipientPhone = restaurantPhone;
        result.callType = "delivery_partner_to_restaurant";
        result.callerRole = "delivery_partner";
        result.recipientRole = "restaurant";
        result.success = true;
        return result;
      }

      result.error = "No valid recipient found for delivery partner";
      result.errorCode = "no_recipient_found";
      return result;
    }

    if (customerPhone && phonesMatch(normalizedFromPhone, customerPhone)) {
      // Customer is calling

      // Prefer delivery partner if available and order not completed
      if (deliveryPartner && deliveryPhone && order.status !== "ready_for_pickup") {
        result.recipientPhone = deliveryPhone;
        result.callType = "customer_to_delivery_partner";
        result.callerRole = "customer";
        result.recipientRole = "delivery_partner";
        result.success = true;
        return result;
      }

      // Fall back to restaurant
      if (restaurantPhone) {
        result.recipientPhone = restaurantPhone;
        result.callType = "customer_to_restaurant";
        result.callerRole = "customer";
        result.recipientRole = "restaurant";
        result.success = true;
        return result;
      }

      result.error = "No valid recipient found for customer";
      result.errorCode = "no_recipient_found";
      return result;
    }

    // Caller not associated with this order
    result.error = "Caller phone not associated with this order";
    result.errorCode = "unauthorized_caller";
    return result;
  } catch (err) {
    console.error("Error in routeIncomingCall:", err);
    result.error = err.message;
    result.errorCode = "internal_error";
    return result;
  }
};

/**
 * Find active call session for an order
 * Returns null if not found or if order is in terminal state
 */
export const findActiveCallSession = async (orderId) => {
  try {
    const order = await Order.findOne({ orderId });
    if (!order || ["completed", "cancelled"].includes(order.status)) {
      return null;
    }
    return order;
  } catch (err) {
    console.error("Error finding active call session:", err);
    return null;
  }
};

/**
 * Validate if call parameters are safe to proceed
 */
export const validateCallSafety = async ({ orderId, incomingFromPhone }) => {
  const order = await Order.findOne({ orderId });

  if (!order) {
    return { safe: false, reason: "order_not_found" };
  }

  if (["completed", "cancelled", "expired"].includes(order.status)) {
    return { safe: false, reason: "order_terminal_state" };
  }

  // Check if incoming phone is associated with order
  const restaurant = await Restaurant.findById(order.restaurantId);
  const customer = await User.findById(order.userId);
  const deliveryPartner = order.deliveryPartnerId
    ? await Delivery.findById(order.deliveryPartnerId)
    : null;

  const validPhones = [
    restaurant?.primaryContactNumber || restaurant?.phone || restaurant?.ownerPhone,
    customer?.phone || customer?.primaryContactNumber || customer?.phoneNumber || customer?.mobile,
    deliveryPartner?.phone || "",
  ].filter(Boolean);

  const isValid = validPhones.some((phone) =>
    phonesMatch(incomingFromPhone, phone)
  );

  if (!isValid) {
    return { safe: false, reason: "unauthorized_caller" };
  }

  return { safe: true };
};
