import Order from '../models/Order.js';
import { notifyDeliveryBoyOrderReady } from './deliveryNotificationService.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import { dispatchDeliveryRequestWithStrategy } from './deliveryAssignmentService.js';

/**
 * Automatically mark orders as ready when ETA becomes 0
 * This runs as a cron job to check all preparing orders
 * @returns {Promise<{processed: number, message: string}>}
 */
export async function processAutoReadyOrders() {
  try {
    // Find all orders with status 'preparing' that have tracking.preparing.timestamp
    const preparingOrders = await Order.find({
      status: 'preparing',
      'tracking.preparing.timestamp': {
        $exists: true
      },
      estimatedDeliveryTime: {
        $exists: true,
        $gt: 0
      }
    }).populate('deliveryPartnerId', 'name phone').lean();
    if (preparingOrders.length === 0) {
      return {
        processed: 0,
        message: 'No preparing orders to check'
      };
    }
    const now = new Date();
    let processedCount = 0;
    const readyOrders = [];
    for (const order of preparingOrders) {
      const preparingTimestamp = order.tracking?.preparing?.timestamp;
      if (!preparingTimestamp) {
        continue;
      }

      // Calculate elapsed time in minutes
      const elapsedMs = now - new Date(preparingTimestamp);
      const elapsedMinutes = Math.floor(elapsedMs / 60000);
      // IMPORTANT: 'estimatedDeliveryTime' includes travel time.
      // Auto-ready should depend on kitchen prep time (+ restaurant-added time), not delivery ETA.
      const estimatedTime = Math.max(
        1,
        Number(order.preparationTime || 0) + Number(order.eta?.additionalTime || 0)
      );

      // Check if ETA has elapsed (with 5 second buffer to account for cron interval)
      if (elapsedMinutes >= estimatedTime) {
        try {
          // Update order status to ready
          const updatedOrder = await Order.findByIdAndUpdate(order._id, {
            $set: {
              status: 'ready',
              'tracking.ready': {
                status: true,
                timestamp: now
              }
            }
          }, {
            new: true
          }).populate('restaurantId', 'name location address phone').populate('userId', 'name phone').populate('deliveryPartnerId', 'name phone').lean();
          if (updatedOrder) {
            readyOrders.push(updatedOrder);
            processedCount++;
            // Notify delivery boy if order is assigned
            if (updatedOrder.deliveryPartnerId) {
              try {
                await notifyDeliveryBoyOrderReady(updatedOrder, updatedOrder.deliveryPartnerId._id || updatedOrder.deliveryPartnerId);
              } catch (notifError) {
                console.error(`❌ Error notifying delivery boy about order ${order.orderId}:`, notifError);
              }
            }
            // If order is not assigned yet, broadcast it to nearby delivery partners (same as manual "mark ready")
            if (!updatedOrder.deliveryPartnerId) {
              try {
                let restaurantDoc = null;
                const restaurantIdRaw = updatedOrder.restaurantId;
                const looksLikeObjectId = typeof restaurantIdRaw === 'string' && /^[a-f\\d]{24}$/i.test(restaurantIdRaw);
                if (looksLikeObjectId) {
                  restaurantDoc = await Restaurant.findById(restaurantIdRaw)
                    .select('location.coordinates location.latitude location.longitude restaurantId')
                    .lean();
                }
                if (!restaurantDoc && restaurantIdRaw) {
                  restaurantDoc = await Restaurant.findOne({
                    $or: [{ restaurantId: restaurantIdRaw }, { _id: restaurantIdRaw }]
                  }).select('location.coordinates location.latitude location.longitude restaurantId')
                    .lean();
                }

                let restaurantLat = null;
                let restaurantLng = null;
                const coords = restaurantDoc?.location?.coordinates;
                if (Array.isArray(coords) && coords.length >= 2) {
                  const [lng, lat] = coords;
                  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
                    restaurantLat = Number(lat);
                    restaurantLng = Number(lng);
                  }
                }
                if (!restaurantLat || !restaurantLng) {
                  const lat = restaurantDoc?.location?.latitude;
                  const lng = restaurantDoc?.location?.longitude;
                  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
                    restaurantLat = Number(lat);
                    restaurantLng = Number(lng);
                  }
                }

                if (Number.isFinite(restaurantLat) && Number.isFinite(restaurantLng)) {
                  console.log('📣 [AutoReady] Broadcast on ready for order', updatedOrder.orderId || updatedOrder._id.toString());
                  const result = await dispatchDeliveryRequestWithStrategy(updatedOrder._id.toString(), restaurantLat, restaurantLng, { trigger: 'auto_ready' });
                  console.log('📊 [AutoReady] Ready broadcast recipients', {
                    orderId: updatedOrder.orderId || null,
                    orderMongoId: updatedOrder._id?.toString?.() || null,
                    notifiedCount: Number(result?.notifiedCount || 0),
                    candidatesCount: Array.isArray(result?.deliveryPartnerIds) ? result.deliveryPartnerIds.length : 0
                  });
                } else {
                  console.warn(`⚠️ [AutoReady] Restaurant location missing; cannot broadcast order ${updatedOrder.orderId || updatedOrder._id}`);
                }
              } catch (broadcastErr) {
                console.error(`❌ [AutoReady] Failed broadcasting order ${updatedOrder.orderId || updatedOrder._id}:`, broadcastErr);
              }
            }
          }
        } catch (updateError) {
          console.error(`❌ Error updating order ${order.orderId} to ready:`, updateError);
        }
      }
    }
    return {
      processed: processedCount,
      message: processedCount > 0 ? `Marked ${processedCount} order(s) as ready automatically` : 'No orders ready yet'
    };
  } catch (error) {
    console.error('❌ Error processing auto-ready orders:', error);
    return {
      processed: 0,
      message: `Error: ${error.message}`
    };
  }
}
