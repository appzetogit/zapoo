import Order from '../models/Order.js';
import Payment from '../../payment/models/Payment.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import mongoose from 'mongoose';
import { sendNotificationToUser } from '../../notification/utils/pushNotificationHelper.js';

// Dynamic import to avoid circular dependency
let getIO = null;
async function getIOInstance() {
  if (!getIO) {
    const serverModule = await import('../../../server.js');
    getIO = serverModule.getIO;
  }
  return getIO ? getIO() : null;
}

/**
 * Notify restaurant about new order via Socket.IO
 * @param {Object} order - Order document
 * @param {string} restaurantId - Restaurant ID
 * @param {string} [paymentMethodOverride] - Explicit payment method ('cash' | 'razorpay') so restaurant sees correct value
 */
export async function notifyRestaurantNewOrder(order, restaurantId, paymentMethodOverride) {
  try {
    const io = await getIOInstance();
    if (!io) {
      console.warn('Socket.IO not initialized, skipping restaurant notification');
      return;
    }

    // CRITICAL: Validate restaurantId matches order's restaurantId
    const orderRestaurantId = order.restaurantId?.toString() || order.restaurantId;
    const providedRestaurantId = restaurantId?.toString() || restaurantId;
    if (orderRestaurantId !== providedRestaurantId) {
      console.error('❌ CRITICAL: RestaurantId mismatch in notification!', {
        orderRestaurantId: orderRestaurantId,
        providedRestaurantId: providedRestaurantId,
        orderId: order.orderId,
        orderRestaurantName: order.restaurantName
      });
      // Use order's restaurantId instead of provided one
      restaurantId = orderRestaurantId;
    }

    // Get restaurant details
    let restaurant = null;
    if (mongoose.Types.ObjectId.isValid(restaurantId)) {
      restaurant = await Restaurant.findById(restaurantId).lean();
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [
          { restaurantId: restaurantId },
          { slug: restaurantId },
          ...(mongoose.Types.ObjectId.isValid(restaurantId) ? [{ _id: restaurantId }] : [])
        ]
      }).lean();
    }

    // Validate restaurant name matches order
    if (restaurant && order.restaurantName && restaurant.name !== order.restaurantName) {
      console.warn('⚠️ Restaurant name mismatch:', {
        orderRestaurantName: order.restaurantName,
        foundRestaurantName: restaurant.name,
        restaurantId: restaurantId
      });
      // Still proceed but log warning
    }

    // Resolve payment method: override > order.payment > Payment collection (COD fallback)
    let resolvedPaymentMethod = paymentMethodOverride ?? order.payment?.method ?? 'razorpay';
    if (resolvedPaymentMethod !== 'cash') {
      try {
        const paymentRecord = await Payment.findOne({
          orderId: order._id
        }).select('method').lean();
        if (paymentRecord?.method === 'cash') resolvedPaymentMethod = 'cash';
      } catch (e) {/* ignore */}
    }

    // Prepare order notification data
    const orderNotification = {
      orderId: order.orderId,
      orderMongoId: order._id.toString(),
      restaurantId: restaurantId,
      restaurantName: order.restaurantName,
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      total: order.pricing.total,
      customerAddress: {
        label: order.address.label,
        street: order.address.street,
        city: order.address.city,
        location: order.address.location
      },
      status: order.status,
      createdAt: order.createdAt,
      estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
      note: order.note || '',
      sendCutlery: order.sendCutlery,
      paymentMethod: resolvedPaymentMethod,
      deliveryFee: order.pricing?.deliveryFee ?? 0,
      adminDeliveryCost: order.pricing?.adminDeliveryCost ?? 0,
      distanceKm: order.pricing?.distanceKm ?? 0,
    };
    // Get restaurant namespace
    const restaurantNamespace = io.of('/restaurant');

    // Build comprehensive room identifiers to handle _id / restaurantId / slug mismatches.
    const normalizedRestaurantId = restaurantId?.toString() || restaurantId;
    const candidateIds = Array.from(new Set([
      normalizedRestaurantId,
      order.restaurantId?.toString?.() || order.restaurantId || null,
      restaurant?._id?.toString?.() || null,
      restaurant?.restaurantId?.toString?.() || restaurant?.restaurantId || null,
      restaurant?.slug?.toString?.() || restaurant?.slug || null
    ].filter(Boolean)));
    const roomVariations = Array.from(new Set(
      candidateIds.flatMap((id) => {
        const baseRoom = `restaurant:${id}`;
        if (mongoose.Types.ObjectId.isValid(id)) {
          return [baseRoom, `restaurant:${new mongoose.Types.ObjectId(id).toString()}`];
        }
        return [baseRoom];
      })
    ));

    console.log('🍽️ [RestaurantNotify] Attempting new_order emit', {
      orderId: order.orderId,
      orderMongoId: order._id?.toString?.(),
      paymentStatus: order.payment?.status,
      paymentMethod: resolvedPaymentMethod,
      orderRestaurantId: order.restaurantId,
      providedRestaurantId: restaurantId,
      resolvedRestaurant: restaurant
        ? {
            _id: restaurant._id?.toString?.() || restaurant._id,
            restaurantId: restaurant.restaurantId || null,
            slug: restaurant.slug || null,
            name: restaurant.name || null
          }
        : null,
      roomVariations
    });

    // Get all connected sockets in the restaurant room
    let socketsInRoom = [];
    const roomProbe = [];
    for (const room of roomVariations) {
      const sockets = await restaurantNamespace.in(room).fetchSockets();
      roomProbe.push({
        room,
        sockets: sockets.map((socket) => socket.id)
      });
      if (sockets.length > 0) {
        socketsInRoom = sockets;
        break;
      }
    }
    const primaryRoom = roomVariations[0];
    // CRITICAL: Only emit to the specific restaurant room - NEVER broadcast to all restaurants
    // This ensures orders only go to the correct restaurant
    let socketDeliveryFailed = false;
    let socketFailureMessage = null;
    if (socketsInRoom.length > 0) {
      console.log('🍽️ [RestaurantNotify] Restaurant sockets found', {
        orderId: order.orderId,
        primaryRoom,
        sockets: socketsInRoom.map((socket) => socket.id),
        roomProbe
      });
      // Found sockets in the restaurant room - send notification only to that room
      roomVariations.forEach(room => {
        restaurantNamespace.to(room).emit('new_order', orderNotification);
        restaurantNamespace.to(room).emit('play_notification_sound', {
          type: 'new_order',
          orderId: order.orderId,
          message: `New order received: ${order.orderId}`
        });
      });
    } else {
      // No sockets found in restaurant room - log error but DO NOT broadcast to all restaurants
      console.error(`❌ CRITICAL: No sockets found for restaurant ${normalizedRestaurantId} in any room!`);
      console.error(`❌ Order ${order.orderId} will NOT be delivered to restaurant ${normalizedRestaurantId}`);
      console.error(`❌ Room variations tried:`, roomVariations);
      console.error(`❌ Restaurant name: ${order.restaurantName}`);
      console.error(`❌ Restaurant ID from order: ${order.restaurantId}`);
      console.error(`❌ Normalized restaurant ID: ${normalizedRestaurantId}`);

      // Log all connected restaurant sockets for debugging (but don't send to them)
      const allSockets = await restaurantNamespace.fetchSockets();
      console.error('❌ [RestaurantNotify] Room probe result:', roomProbe);
      if (allSockets.length > 0) {
        // Get room information for each socket
        const socketRooms = [];
        for (const socket of allSockets) {
          const rooms = Array.from(socket.rooms);
          socketRooms.push({
            socketId: socket.id,
            rooms: rooms.filter(r => r.startsWith('restaurant:'))
          });
        }
        console.error('❌ [RestaurantNotify] Connected restaurant sockets snapshot:', socketRooms);
      }

      // Still try to emit to room variations (in case socket connects later)
      // But DO NOT broadcast to all restaurants
      roomVariations.forEach(room => {
        restaurantNamespace.to(room).emit('new_order', orderNotification);
        restaurantNamespace.to(room).emit('play_notification_sound', {
          type: 'new_order',
          orderId: order.orderId,
          message: `New order received: ${order.orderId}`
        });
      });

      socketDeliveryFailed = true;
      socketFailureMessage = `Restaurant ${normalizedRestaurantId} (${order.restaurantName}) is not connected to Socket.IO room.`;
    }

    // Send FCM notification to restaurant (always send)
    try {
      const normalizedRestaurantId = restaurantId?.toString() || restaurantId;
      await sendNotificationToUser(normalizedRestaurantId, 'restaurant', 'New Order Received!', `Order #${order.orderId} for ₹${order.pricing?.total ?? 0}`, {
        orderId: order.orderId,
        orderMongoId: order._id?.toString(),
        status: order.status,
        type: 'new_order',
        templateKey: 'restaurant_new_order',
        templateVars: {
          orderId: order.orderId,
          total: order.pricing?.total ?? 0
        }
      });
    } catch (pushError) {
      console.error('❌ [FCM] Error sending restaurant new order notification:', pushError);
    }
    return {
      success: !socketDeliveryFailed,
      restaurantId,
      orderId: order.orderId,
      ...(socketDeliveryFailed
        ? {
            warning: 'socket_delivery_failed',
            message: socketFailureMessage
          }
        : {})
    };
  } catch (error) {
    console.error('Error notifying restaurant:', error);
    throw error;
  }
}

/**
 * Notify restaurant about order status update
 * @param {string} orderId - Order ID
 * @param {string} status - New status
 */
export async function notifyRestaurantOrderUpdate(orderId, status) {
  try {
    const io = await getIOInstance();
    if (!io) {
      return;
    }
    const order = await Order.findById(orderId).lean();
    if (!order) {
      throw new Error('Order not found');
    }

    const normalizedStatus = status || order.status;
    const wasPreparingBeforeCancel = Boolean(order?.tracking?.preparing?.status);
    const isCustomerCancelled = normalizedStatus === 'cancelled' && order?.cancelledBy === 'user';
    const statusUpdateMessage = isCustomerCancelled
      ? wasPreparingBeforeCancel
        ? `Order #${order.orderId} was cancelled by customer during preparation.`
        : `Order #${order.orderId} was cancelled by customer.`
      : null;

    // Get restaurant namespace
    const restaurantNamespace = io.of('/restaurant');
    restaurantNamespace.to(`restaurant:${order.restaurantId}`).emit('order_status_update', {
      orderId: order.orderId,
      status: normalizedStatus,
      cancelledBy: order?.cancelledBy || null,
      cancellationReason: order?.cancellationReason || null,
      message: statusUpdateMessage,
      updatedAt: new Date()
    });

    // Send FCM notification to restaurant for status update.
    // IMPORTANT: Keep notifications enabled, but for accept/ready transitions
    // send a "safe" payload without order action metadata to avoid
    // Accept/Reject action buttons on some Android clients.
    try {
      let title = 'Order Update';
      let body = `Order #${order.orderId} status is now ${normalizedStatus}`;
      const shouldUseSafePayload = ['confirmed', 'preparing', 'ready'].includes(normalizedStatus);
      if (normalizedStatus === 'delivered') {
        title = '✅ Order Delivered!';
        body = `Order #${order.orderId} has been delivered.`;
      } else if (normalizedStatus === 'cancelled') {
        title = '❌ Order Cancelled';
        body = `Order #${order.orderId} was cancelled.`;
        if (isCustomerCancelled) {
          title = 'Order Cancelled by Customer';
          body = wasPreparingBeforeCancel
            ? `Order #${order.orderId} was cancelled by customer during preparation.`
            : `Order #${order.orderId} was cancelled by customer.`;
        }
      } else if (normalizedStatus === 'ready') {
        title = '🥡 Order Ready';
        body = `Order #${order.orderId} is ready for pickup.`;
      } else if (normalizedStatus === 'confirmed') {
        title = '✅ Order Confirmed';
        body = `Order #${order.orderId} has been confirmed by restaurant.`;
      } else if (normalizedStatus === 'preparing') {
        title = '🍳 Order Preparing';
        body = `Order #${order.orderId} is now being prepared.`;
      } else if (normalizedStatus === 'out_for_delivery') {
        title = '🚴 Out for Delivery';
        body = `Order #${order.orderId} is out for delivery.`;
      }
      const payloadData = shouldUseSafePayload
        ? {
            status: normalizedStatus,
            type: 'restaurant_status_update',
            clickUrl: '/restaurant/orders/all'
          }
        : {
            orderId: order.orderId,
            orderMongoId: order._id?.toString(),
            status: normalizedStatus,
            type: 'order_update'
          };

      await sendNotificationToUser(order.restaurantId?.toString() || order.restaurantId, 'restaurant', title, body, payloadData);
    } catch (pushError) {
      console.error('❌ [FCM] Error sending restaurant status notification:', pushError);
    }
  } catch (error) {
    console.error('Error notifying restaurant about order update:', error);
    throw error;
  }
}

/**
 * Send a restaurant-facing message tied to an order (without changing order status).
 * Uses the existing `order_status_update` socket event so frontend can show it.
 * @param {string} orderId - MongoDB _id
 * @param {{status?: string, message: string, type?: string}} params
 */
export async function notifyRestaurantOrderMessage(orderId, { status, message, type = 'order_message' } = {}) {
  try {
    if (!message) return;
    const io = await getIOInstance();
    if (!io) return;

    const order = await Order.findById(orderId).select('orderId restaurantId status').lean();
    if (!order) return;

    const restaurantNamespace = io.of('/restaurant');
    restaurantNamespace.to(`restaurant:${order.restaurantId}`).emit('order_status_update', {
      orderId: order.orderId,
      status: status || order.status,
      message,
      type,
      updatedAt: new Date()
    });

    try {
      await sendNotificationToUser(order.restaurantId?.toString() || order.restaurantId, 'restaurant', 'Delivery Assignment Update', message, {
        orderId: order.orderId,
        orderMongoId: order._id?.toString(),
        status: status || order.status,
        type
      });
    } catch (pushError) {
      console.error('❌ [FCM] Error sending restaurant message notification:', pushError);
    }
  } catch (error) {
    console.error('Error notifying restaurant with message:', error);
  }
}
