import Order from '../models/Order.js';
import { notifyRestaurantOrderUpdate } from './restaurantNotificationService.js';
import { initiateRazorpayRefundForOrder } from './cancellationRefundService.js';

/**
 * Automatically reject orders that haven't been accepted within the accept time limit
 * This runs as a cron job to check all pending/confirmed orders
 * Accept time limit: 240 seconds (4 minutes)
 * @returns {Promise<{processed: number, message: string}>}
 */
export async function processAutoRejectOrders() {
  try {
    const ACCEPT_TIME_LIMIT_SECONDS = 240; // 4 minutes
    const ACCEPT_TIME_LIMIT_MS = ACCEPT_TIME_LIMIT_SECONDS * 1000;

    // Find all orders with status 'pending' that haven't been accepted yet
    // confirmed orders have been accepted by restaurant or payment verified
    const validPendingOrders = await Order.find({
      status: 'pending'
    }).lean();
    if (validPendingOrders.length === 0) {
      return {
        processed: 0,
        message: 'No pending orders to check'
      };
    }
    const now = new Date();
    let processedCount = 0;
    const rejectedOrders = [];
    for (const order of validPendingOrders) {
      const orderCreatedAt = new Date(order.createdAt);
      const elapsedMs = now - orderCreatedAt;

      // Check if accept time has expired
      if (elapsedMs >= ACCEPT_TIME_LIMIT_MS) {
        try {
          // Double-check order hasn't been accepted or cancelled by another process
          const currentOrder = await Order.findById(order._id);
          if (!currentOrder) {
            continue; // Order was deleted
          }

          // Only reject if still in pending/confirmed status
          if (!['pending', 'confirmed'].includes(currentOrder.status)) {
            continue; // Order was already accepted/rejected
          }

          // Update order status to cancelled
          currentOrder.status = 'cancelled';
          currentOrder.cancellationReason = 'Order not accepted within time limit. Restaurant did not respond in time.';
          currentOrder.cancelledBy = 'restaurant';
          currentOrder.cancelledAt = now;
          await currentOrder.save();
          rejectedOrders.push({
            orderId: currentOrder.orderId,
            elapsedSeconds: Math.floor(elapsedMs / 1000)
          });
          processedCount++;
          // Trigger automatic refund for unaccepted orders.
          try {
            const refundResult = await initiateRazorpayRefundForOrder({
              orderId: currentOrder._id,
              trigger: 'restaurant',
              reason: 'Order not accepted within time limit. Restaurant did not respond in time.'
            });
          } catch (refundError) {
            console.error(`❌ Error calculating cancellation refund for order ${currentOrder.orderId}:`, refundError);
            // Don't fail order cancellation if refund calculation fails
          }

          // Notify about status update
          try {
            await notifyRestaurantOrderUpdate(currentOrder._id.toString(), 'cancelled');
            const assignedDeliveryId = currentOrder.deliveryPartnerId?.toString?.() || currentOrder.deliveryPartnerId;
            if (assignedDeliveryId) {
              const { notifyDeliveryOrderLifecycle } = await import('./deliveryNotificationService.js');
              await notifyDeliveryOrderLifecycle(assignedDeliveryId, currentOrder, 'cancelled');
            }
          } catch (notifError) {
            console.error(`❌ Error sending notification for order ${currentOrder.orderId}:`, notifError);
          }
        } catch (updateError) {
          console.error(`❌ Error auto-rejecting order ${order.orderId}:`, updateError);
        }
      }
    }
    return {
      processed: processedCount,
      message: processedCount > 0 ? `Auto-rejected ${processedCount} order(s) that were not accepted within ${ACCEPT_TIME_LIMIT_SECONDS} seconds` : 'No orders to auto-reject'
    };
  } catch (error) {
    console.error('❌ Error processing auto-reject orders:', error);
    return {
      processed: 0,
      message: `Error: ${error.message}`
    };
  }
}
