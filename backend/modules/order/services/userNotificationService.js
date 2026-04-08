import Order from '../models/Order.js';
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

function buildUserRoomVariations(userId) {
  const rooms = new Set();
  const normalizedId = userId?.toString ? userId.toString() : (userId || '');
  if (normalizedId) {
    rooms.add(`user:${normalizedId}`);
    if (mongoose.Types.ObjectId.isValid(normalizedId)) {
      rooms.add(`user:${new mongoose.Types.ObjectId(normalizedId).toString()}`);
    }
  }
  if (userId) {
    rooms.add(`user:${userId}`);
  }
  return Array.from(rooms);
}

/**
 * Notify user about order status update
 * @param {string} orderId - Order ID (orderId or _id)
 * @param {string} status - New status
 */
export async function notifyUserOrderUpdate(orderId, status) {
  try {
    const io = await getIOInstance();
    if (!io) {
      return;
    }

    // Find order by _id or orderId
    const order = await Order.findOne({
      $or: [{ _id: orderId }, { orderId }]
    }).select('orderId userId status').lean();
    if (!order?.userId) {
      return;
    }

    const userId = order.userId?.toString ? order.userId.toString() : order.userId;
    const roomVariations = buildUserRoomVariations(userId);

    const payload = {
      orderId: order.orderId || orderId,
      orderMongoId: order._id?.toString?.() || orderId,
      status: status || order.status
    };

    roomVariations.forEach(room => {
      io.to(room).emit('order_status_update', payload);
    });

    // Send FCM notification (always send, even if socket connected)
    const normalizedStatus = status || order.status;
    let templateKey = 'user_order_update';
    let title = 'Order Update';
    let body = `Your order #${order.orderId} status is now ${normalizedStatus}`;
    if (normalizedStatus === 'delivered') {
      templateKey = 'user_order_delivered';
      title = 'Order Delivered!';
      body = 'Your food has arrived! Enjoy your meal.';
    } else if (normalizedStatus === 'out_for_delivery') {
      templateKey = 'user_order_out_for_delivery';
      title = 'Order Out for Delivery';
      body = 'Our delivery partner is on the way!';
    } else if (normalizedStatus === 'cancelled') {
      templateKey = 'user_order_cancelled';
      title = 'Order Cancelled';
      body = 'Your order has been cancelled.';
    } else if (normalizedStatus === 'preparing' || normalizedStatus === 'confirmed') {
      templateKey = 'user_order_accepted';
      title = 'Order Accepted';
      body = 'The restaurant is preparing your food.';
    } else if (normalizedStatus === 'ready') {
      templateKey = 'user_order_ready';
      title = 'Order Ready';
      body = 'Your food is ready for pickup.';
    }

    await sendNotificationToUser(userId, 'user', title, body, {
      orderId: order.orderId,
      orderMongoId: order._id?.toString?.() || orderId,
      status: normalizedStatus,
      type: 'order_update',
      templateKey,
      templateVars: {
        orderId: order.orderId,
        status: normalizedStatus
      }
    });
  } catch (error) {
    console.error('Error notifying user about order update:', error);
  }
}
