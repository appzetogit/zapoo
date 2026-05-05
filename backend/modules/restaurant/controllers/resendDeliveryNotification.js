import Order from '../../order/models/Order.js';
import Restaurant from '../models/Restaurant.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import { broadcastDeliveryRequest } from '../../order/services/deliveryAssignmentService.js';
import mongoose from 'mongoose';

/**
 * Resend delivery notification for unassigned order
 * POST /api/restaurant/orders/:id/resend-delivery-notification
 */
export const resendDeliveryNotification = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const {
      id
    } = req.params;
    const restaurantId = restaurant._id?.toString() || restaurant.restaurantId || restaurant.id;
    const restaurantIdVariations = [restaurantId].filter(Boolean);
    if (restaurant?._id) {
      const mongoId = restaurant._id.toString();
      if (!restaurantIdVariations.includes(mongoId)) {
        restaurantIdVariations.push(mongoId);
      }
    }
    if (restaurant?.restaurantId && !restaurantIdVariations.includes(restaurant.restaurantId)) {
      restaurantIdVariations.push(restaurant.restaurantId);
    }
    if (mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
      const objectIdString = new mongoose.Types.ObjectId(restaurantId).toString();
      if (!restaurantIdVariations.includes(objectIdString)) {
        restaurantIdVariations.push(objectIdString);
      }
    }

    // Try to find order by MongoDB _id or orderId
    let order = null;
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findOne({
        _id: id,
        restaurantId: {
          $in: restaurantIdVariations
        }
      });
    }
    if (!order) {
      order = await Order.findOne({
        orderId: id,
        restaurantId: {
          $in: restaurantIdVariations
        }
      });
    }
    if (!order) {
      console.warn('⚠️ [DeliveryAssign] Resend failed: order not found for restaurant', {
        orderParam: id,
        restaurantId,
        restaurantIdVariations
      });
      return errorResponse(res, 404, 'Order not found');
    }

    // Allow resend from accepted-stage too (`confirmed`) so dispatch recovery works before READY.
    if (!['confirmed', 'preparing', 'ready'].includes(order.status)) {
      return errorResponse(res, 400, `Cannot resend notification. Order status must be 'confirmed', 'preparing' or 'ready'. Current status: ${order.status}`);
    }

    // Get restaurant location
    let restaurantDoc = null;
    if (mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24) {
      restaurantDoc = await Restaurant.findById(restaurantId).select('location restaurantId').lean();
    }
    if (!restaurantDoc) {
      restaurantDoc = await Restaurant.findOne({
        $or: [
          {
            _id: mongoose.Types.ObjectId.isValid(restaurantId) && restaurantId.length === 24
              ? new mongoose.Types.ObjectId(restaurantId)
              : null
          },
          {
            restaurantId: {
              $in: restaurantIdVariations
            }
          },
          {
            _id: mongoose.Types.ObjectId.isValid(order.restaurantId) && String(order.restaurantId).length === 24
              ? new mongoose.Types.ObjectId(order.restaurantId)
              : null
          },
          {
            restaurantId: order.restaurantId
          }
        ]
      }).select('location restaurantId').lean();
    }
    if (!restaurantDoc || !restaurantDoc.location || !restaurantDoc.location.coordinates) {
      console.warn('⚠️ [DeliveryAssign] Resend failed: restaurant coordinates missing', {
        orderId: order.orderId || null,
        orderMongoId: order._id?.toString?.() || null,
        restaurantId,
        orderRestaurantId: order.restaurantId
      });
      return errorResponse(res, 400, 'Restaurant location not found. Please update restaurant location.');
    }
    const [restaurantLng, restaurantLat] = restaurantDoc.location.coordinates;

    console.log('📤 [DeliveryAssign] Resend trigger', {
      orderId: order.orderId || null,
      orderMongoId: order._id?.toString?.() || null,
      restaurantId: restaurantId?.toString?.() || String(restaurantId || ''),
      orderRestaurantId: order.restaurantId,
      restaurantLat,
      restaurantLng
    });

    const result = await broadcastDeliveryRequest(order._id.toString(), restaurantLat, restaurantLng, { trigger: 'manual_resend' });
    console.log('📊 [DeliveryAssign] Resend broadcast recipients', {
      orderId: order.orderId || null,
      orderMongoId: order._id?.toString?.() || null,
      restaurantId: restaurantId?.toString?.() || String(restaurantId || ''),
      notifiedCount: Number(result?.notifiedCount || 0),
      candidatesCount: Array.isArray(result?.deliveryPartnerIds) ? result.deliveryPartnerIds.length : 0
    });
    return successResponse(res, 200, `Notification sent to ${result?.notifiedCount || 0} delivery partners`, {
      orderId: order.orderId,
      orderMongoId: order._id?.toString(),
      notifiedCount: result?.notifiedCount || 0
    });
  } catch (error) {
    console.error('Error resending delivery notification:', error);
    return errorResponse(res, 500, `Failed to resend notification: ${error.message}`);
  }
});
