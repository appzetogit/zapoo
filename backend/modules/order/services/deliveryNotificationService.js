import Order from '../models/Order.js';
import Delivery from '../../delivery/models/Delivery.js';
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

function getDeliverySocketEmitters(io) {
  if (!io) return [];
  const emitters = [io.of('/delivery'), io].filter(Boolean);
  return emitters;
}

async function fetchSocketsInAnyDeliveryEmitter(io, room) {
  const emitters = getDeliverySocketEmitters(io);
  for (const emitter of emitters) {
    const sockets = await emitter.in(room).fetchSockets();
    if (sockets.length > 0) {
      return { sockets, emitter };
    }
  }
  return { sockets: [], emitter: null };
}

function emitToDeliveryRoomAll(io, room, eventName, payload) {
  const emitters = getDeliverySocketEmitters(io);
  emitters.forEach((emitter) => {
    emitter.to(room).emit(eventName, payload);
  });
}

function emitToAllDeliverySockets(io, eventName, payload) {
  const emitters = getDeliverySocketEmitters(io);
  emitters.forEach((emitter) => emitter.emit(eventName, payload));
}

function buildDeliveryRoomVariations(deliveryPartnerId, deliveryId) {
  const rooms = new Set();
  const normalizedId = deliveryPartnerId?.toString ? deliveryPartnerId.toString() : (deliveryPartnerId || '');
  if (normalizedId) {
    rooms.add(`delivery:${normalizedId}`);
    if (mongoose.Types.ObjectId.isValid(normalizedId)) {
      rooms.add(`delivery:${new mongoose.Types.ObjectId(normalizedId).toString()}`);
    }
  }
  if (deliveryPartnerId) {
    rooms.add(`delivery:${deliveryPartnerId}`);
  }
  if (deliveryId) {
    rooms.add(`delivery:${deliveryId}`);
  }
  return Array.from(rooms);
}

/**
 * Check if delivery partner is connected to socket
 * @param {string} deliveryPartnerId - Delivery partner ID
 * @returns {Promise<{connected: boolean, room: string|null, socketCount: number}>}
 */
export async function checkDeliveryPartnerConnection(deliveryPartnerId) {
  try {
    const io = await getIOInstance();
    if (!io) {
      return {
        connected: false,
        room: null,
        socketCount: 0
      };
    }
    const normalizedId = deliveryPartnerId?.toString() || deliveryPartnerId;
    let roomVariations = buildDeliveryRoomVariations(normalizedId, null);
    console.log('🔎 [DeliverySocketCheck] Checking connection', {
      deliveryPartnerId: normalizedId,
      roomVariations
    });
    for (const room of roomVariations) {
      const { sockets, emitter } = await fetchSocketsInAnyDeliveryEmitter(io, room);
      if (sockets.length > 0) {
        console.log('✅ [DeliverySocketCheck] Connected', {
          deliveryPartnerId: normalizedId,
          room,
          emitter: emitter?.name || '/',
          socketCount: sockets.length,
          socketIds: sockets.map(s => s.id)
        });
        return {
          connected: true,
          room,
          socketCount: sockets.length
        };
      }
    }
    // Fallback: also try deliveryId-based room if available
    if (mongoose.Types.ObjectId.isValid(normalizedId)) {
      const { FoodDeliveryPartner } = await import('../../deliveryV2/models/deliveryPartner.model.js');
      let delivery = await FoodDeliveryPartner.findById(normalizedId).select('deliveryId').lean();
      if (!delivery) {
        delivery = await Delivery.findById(normalizedId).select('deliveryId').lean();
      }
      if (delivery?.deliveryId) {
        roomVariations = buildDeliveryRoomVariations(normalizedId, delivery.deliveryId);
        console.log('🔎 [DeliverySocketCheck] Retrying with deliveryId-based rooms', {
          deliveryPartnerId: normalizedId,
          deliveryId: delivery.deliveryId,
          roomVariations
        });
        for (const room of roomVariations) {
          const { sockets, emitter } = await fetchSocketsInAnyDeliveryEmitter(io, room);
          if (sockets.length > 0) {
            console.log('✅ [DeliverySocketCheck] Connected (deliveryId room)', {
              deliveryPartnerId: normalizedId,
              room,
              emitter: emitter?.name || '/',
              socketCount: sockets.length,
              socketIds: sockets.map(s => s.id)
            });
            return {
              connected: true,
              room,
              socketCount: sockets.length
            };
          }
        }
      }
    }
    console.warn('⚠️ [DeliverySocketCheck] Not connected in any known room', {
      deliveryPartnerId: normalizedId,
      roomVariationsTried: roomVariations
    });
    return {
      connected: false,
      room: null,
      socketCount: 0
    };
  } catch (error) {
    console.error('Error checking delivery partner connection:', error);
    return {
      connected: false,
      room: null,
      socketCount: 0
    };
  }
}

/**
 * Notify delivery boy about new order assignment via Socket.IO
 * @param {Object} order - Order document
 * @param {string} deliveryPartnerId - Delivery partner ID
 */
export async function notifyDeliveryBoyNewOrder(order, deliveryPartnerId) {
  console.log(`\n========================================`);
  console.log(`[DELIVERY-NOTIF-DEBUG] notifyDeliveryBoyNewOrder CALLED`);
  console.log(`[DELIVERY-NOTIF-DEBUG] deliveryPartnerId: ${deliveryPartnerId}, orderId: ${order._id}`);
  console.log(`========================================\n`);

  // CRITICAL: Don't notify if order is cancelled
  if (order.status === 'cancelled') {
    console.warn(`[DELIVERY-NOTIF-DEBUG] Order cancelled, aborting.`);
    return {
      success: false,
      reason: 'Order is cancelled'
    };
  }
  try {
    const io = await getIOInstance();
    const socketAvailable = Boolean(io);
    if (!socketAvailable) {
      console.warn('Socket.IO not initialized, skipping delivery socket notification but continuing with push.');
    }

    // Populate userId if it's not already populated
    let orderWithUser = order;
    if (order.userId && typeof order.userId === 'object' && order.userId._id) {
      // Already populated
      orderWithUser = order;
    } else if (order.userId) {
      // Need to populate
      const OrderModel = await import('../models/Order.js');
      orderWithUser = await OrderModel.default.findById(order._id).populate('userId', 'name phone').lean();
    }

    // Get delivery partner details
    let deliveryPartner = null;
    const { FoodDeliveryPartner } = await import('../../deliveryV2/models/deliveryPartner.model.js');
    deliveryPartner = await FoodDeliveryPartner.findById(deliveryPartnerId).select('name phone availability.currentLocation availability.isOnline status isActive').lean();
    
    if (!deliveryPartner) {
      deliveryPartner = await Delivery.findById(deliveryPartnerId).select('name phone availability.currentLocation availability.isOnline status isActive').lean();
    }
    
    if (!deliveryPartner) {
      console.error(`❌ Delivery partner not found: ${deliveryPartnerId}`);
      return;
    }

    // Verify delivery partner is online and active
    if (!deliveryPartner.availability?.isOnline) {
      console.warn(`⚠️ Delivery partner ${deliveryPartnerId} (${deliveryPartner.name}) is not online. Notification may not be received.`);
    }
    if (!deliveryPartner.isActive) {
      console.warn(`⚠️ Delivery partner ${deliveryPartnerId} (${deliveryPartner.name}) is not active.`);
    }
    if (!deliveryPartner.availability?.currentLocation?.coordinates || deliveryPartner.availability.currentLocation.coordinates[0] === 0 && deliveryPartner.availability.currentLocation.coordinates[1] === 0) {
      console.warn(`⚠️ Delivery partner ${deliveryPartnerId} (${deliveryPartner.name}) has no valid location.`);
    }
    // Check if delivery partner is connected to socket BEFORE trying to notify
    const connectionStatus = socketAvailable
      ? await checkDeliveryPartnerConnection(deliveryPartnerId)
      : { connected: false, room: null, socketCount: 0 };
    if (!connectionStatus.connected) {
      console.warn(`⚠️ Delivery partner ${deliveryPartnerId} (${deliveryPartner.name}) is NOT connected to socket!`);
      console.warn(`⚠️ Notification will be sent but may not be received until they reconnect.`);
    } else {}

    // Get restaurant details for pickup location
    let restaurant = null;
    if (mongoose.Types.ObjectId.isValid(order.restaurantId)) {
      restaurant = await Restaurant.findById(order.restaurantId).lean();
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [{
          restaurantId: order.restaurantId
        }, {
          _id: order.restaurantId
        }]
      }).lean();
    }

    // Calculate distances
    let pickupDistance = null;
    const pricingDistanceKm = Number(orderWithUser?.pricing?.distanceKm);
    let deliveryDistance = Number.isFinite(pricingDistanceKm) && pricingDistanceKm > 0 ? pricingDistanceKm : null;
    if (deliveryPartner.availability?.currentLocation?.coordinates && restaurant?.location?.coordinates) {
      const [deliveryLng, deliveryLat] = deliveryPartner.availability.currentLocation.coordinates;
      const [restaurantLng, restaurantLat] = restaurant.location.coordinates;
      const [customerLng, customerLat] = order.address.location.coordinates;

      // Calculate pickup distance (delivery boy to restaurant)
      pickupDistance = calculateDistance(deliveryLat, deliveryLng, restaurantLat, restaurantLng);

      // Calculate delivery distance (restaurant to customer) only when pricing snapshot is unavailable
      if (!(Number.isFinite(deliveryDistance) && deliveryDistance > 0)) {
        deliveryDistance = calculateDistance(restaurantLat, restaurantLng, customerLat, customerLng);
      }
    }

    // Resolve tier name from restaurant zone if available
    let tierName = orderWithUser?.pricing?.pricingMeta?.tierName || null;
    let adminRetentionPercent = 0;
    try {
      const Tier = (await import('../../admin/models/Tier.js')).default;
      if (tierName) {
        const tierByName = await Tier.findOne({ name: tierName }).select('deliveryPricing.adminRetentionPercent').lean();
        adminRetentionPercent = clampPercent(tierByName?.deliveryPricing?.adminRetentionPercent ?? 0);
      } else {
        const Zone = (await import('../../admin/models/Zone.js')).default;
        const restaurantZoneId = restaurant?.zoneId;
        if (restaurantZoneId) {
          const zone = await Zone.findById(restaurantZoneId).select('tierId').lean();
          if (zone?.tierId) {
            const tier = await Tier.findById(zone.tierId).select('name deliveryPricing.adminRetentionPercent').lean();
            tierName = tier?.name || null;
            adminRetentionPercent = clampPercent(tier?.deliveryPricing?.adminRetentionPercent ?? 0);
          }
        }
      }
    } catch (tierError) {
      console.error('Error resolving tier for notification earnings:', tierError.message);
    }

    // Calculate estimated earnings strictly from delivery commission rules
    const deliveryFeeFromOrder = order.pricing?.deliveryFee ?? 0;
    const adminDeliveryCost = order.pricing?.adminDeliveryCost ?? deliveryFeeFromOrder;
    let estimatedEarnings = await calculateEstimatedEarnings(
      deliveryDistance || 0,
      tierName,
      adminDeliveryCost,
      adminRetentionPercent
    );

    // Prepare order notification data
    const orderNotification = {
      orderId: order.orderId,
      orderMongoId: order._id.toString(),
      restaurantId: order.restaurantId,
      restaurantName: order.restaurantName,
      restaurantLocation: restaurant?.location ? {
        latitude: restaurant.location.coordinates[1],
        longitude: restaurant.location.coordinates[0],
        address: restaurant.location.formattedAddress || restaurant.address || 'Restaurant address'
      } : null,
      customerLocation: {
        latitude: order.address.location.coordinates[1],
        longitude: order.address.location.coordinates[0],
        address: order.address.formattedAddress || `${order.address.street}, ${order.address.city}` || 'Customer address'
      },
      items: order.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      total: order.pricing.total,
      deliveryFee: deliveryFeeFromOrder,
      customerName: order?.customerName?.trim() || orderWithUser.userId?.name || 'Customer',
      customerPhone: order?.customerPhone?.trim() || orderWithUser.userId?.phone || '',
      status: order.status,
      createdAt: order.createdAt,
      estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
      note: order.note || '',
      pickupDistance: pickupDistance ? `${pickupDistance.toFixed(2)} km` : 'Distance not available',
      deliveryDistance: deliveryDistance ? `${Number(deliveryDistance).toFixed(2)} km` : 'Calculating...',
      deliveryDistanceRaw: deliveryDistance || 0,
      // Raw distance number for calculations
      estimatedEarnings
    };

    // Get delivery namespace
    // Normalize deliveryPartnerId to string
    const normalizedDeliveryPartnerId = deliveryPartnerId?.toString() || deliveryPartnerId;

    // Try multiple room formats to ensure we find the delivery partner
    const roomVariations = buildDeliveryRoomVariations(normalizedDeliveryPartnerId, deliveryPartner?.deliveryId);
    console.log('📣 [DeliveryNotify] Emitting new_order', {
      orderId: order.orderId,
      deliveryPartnerId: normalizedDeliveryPartnerId,
      deliveryPartnerDeliveryId: deliveryPartner?.deliveryId || null,
      roomVariations
    });

    // Get all connected sockets in the delivery partner room
    let socketsInRoom = [];
    let foundRoom = null;

    // First, get all connected sockets in delivery namespace for debugging
    const allSocketsByEmitter = socketAvailable
      ? await Promise.all(
          getDeliverySocketEmitters(io).map(async (emitter) => {
            const sockets = await emitter.fetchSockets();
            return { emitter: emitter?.name || '/', sockets };
          })
        )
      : [];
    // Check each room variation
    if (socketAvailable) {
    for (const room of roomVariations) {
      const { sockets, emitter } = await fetchSocketsInAnyDeliveryEmitter(io, room);
      if (sockets.length > 0) {
        socketsInRoom = sockets;
        foundRoom = room;
        console.log('📣 [DeliveryNotify] Active room found', {
          room,
          emitter: emitter?.name || '/',
          socketCount: sockets.length
        });
        break;
      } else {
        // noop
      }
    }
    }
    const primaryRoom = roomVariations[0];
    // Emit new order notification to all room variations (even if no sockets found, in case they connect)
    let notificationSent = false;
    if (socketAvailable) {
      roomVariations.forEach(room => {
        emitToDeliveryRoomAll(io, room, 'new_order', orderNotification);
        emitToDeliveryRoomAll(io, room, 'play_notification_sound', {
          type: 'new_order',
          orderId: order.orderId,
          message: `New order assigned: ${order.orderId}`
        });
        notificationSent = true;
      });
    }

    // Also emit to all sockets in the delivery namespace (fallback if no specific room found)
    if (socketAvailable && socketsInRoom.length === 0) {
      console.warn(`⚠️ No sockets connected in any delivery room for partner ${normalizedDeliveryPartnerId}`);
      console.warn(`⚠️ Delivery partner details:`, {
        id: normalizedDeliveryPartnerId,
        name: deliveryPartner.name,
        isOnline: deliveryPartner.availability?.isOnline,
        isActive: deliveryPartner.isActive,
        status: deliveryPartner.status
      });
      console.warn(`⚠️ This means the delivery partner is not currently connected to the app`);
      console.warn(`⚠️ Possible reasons:`);
      console.warn(`  1. Delivery partner app is closed or not running`);
      console.warn(`  2. Delivery partner is not logged in`);
      console.warn(`  3. Socket connection failed`);
      console.warn(`  4. Delivery partner needs to refresh their app`);
      console.warn(`  5. Delivery partner ID mismatch (check if ID used to join room matches ${normalizedDeliveryPartnerId})`);
      const totalSockets = allSocketsByEmitter.reduce((acc, item) => acc + (item.sockets?.length || 0), 0);
      if (totalSockets === 0) {
        console.warn(`⚠️ No delivery partners are currently connected to the app!`);
      }

      // Optional fallback broadcast (disabled by default to avoid showing orders to wrong partners)
      if (process.env.DELIVERY_BROADCAST_FALLBACK === 'true') {
        console.warn(`⚠️ Broadcasting to all delivery sockets as fallback (in case they connect later)`);
        emitToAllDeliverySockets(io, 'new_order', orderNotification);
        emitToAllDeliverySockets(io, 'play_notification_sound', {
          type: 'new_order',
          orderId: order.orderId,
          message: `New order assigned: ${order.orderId}`
        });
        notificationSent = true;
      }
    } else {}
    if (notificationSent) {} else if (socketAvailable) {
      console.error(`❌ Failed to send notification - no sockets found and broadcast failed`);
    }

    // Send FCM push to delivery partner (always send)
    try {
      await sendNotificationToUser(normalizedDeliveryPartnerId, 'delivery', 'New Order Assigned', `Order #${order.orderId} from ${order.restaurantName || 'restaurant'}`, {
        orderId: order.orderId,
        orderMongoId: order._id?.toString(),
        status: order.status,
        type: 'new_order',
        clickUrl: `/delivery?orderId=${order._id?.toString()}`,
        notificationPriority: 'high',
        templateKey: 'delivery_new_order',
        templateVars: {
          orderId: order.orderId,
          restaurantName: order.restaurantName || 'restaurant'
        }
      });
    } catch (pushError) {
      console.error('❌ [FCM] Error sending delivery new order notification:', pushError);
    }
    return {
      success: true,
      deliveryPartnerId,
      orderId: order.orderId
    };
  } catch (error) {
    console.error('Error notifying delivery boy:', error);
    throw error;
  }
}

/**
 * Notify multiple delivery boys about new order (without assigning)
 * Used for priority-based notification where nearest delivery boys get first chance
 * @param {Object} order - Order document
 * @param {Array} deliveryPartnerIds - Array of delivery partner IDs to notify
 * @param {string} phase - Notification phase: 'priority' or 'expanded'
 * @returns {Promise<{success: boolean, notified: number}>}
 */
export async function notifyMultipleDeliveryBoys(order, deliveryPartnerIds, phase = 'priority') {
  try {
    if (!deliveryPartnerIds || deliveryPartnerIds.length === 0) {
      return {
        success: false,
        notified: 0
      };
    }
    const io = await getIOInstance();
    const socketAvailable = Boolean(io);
    if (!socketAvailable) {
      console.warn('Socket.IO not initialized, skipping delivery socket notifications but continuing with push.');
    }
    let notifiedCount = 0;

    // Populate userId if needed
    let orderWithUser = order;
    if (order.userId && typeof order.userId === 'object' && order.userId._id) {
      orderWithUser = order;
    } else if (order.userId) {
      const OrderModel = await import('../models/Order.js');
      orderWithUser = await OrderModel.default.findById(order._id).populate('userId', 'name phone').lean();
    }

    // Get restaurant details for complete address
    let restaurantAddress = 'Restaurant address';
    let restaurantLocation = null;
    if (orderWithUser.restaurantId) {
      // If restaurantId is populated, use it directly
      if (typeof orderWithUser.restaurantId === 'object') {
        restaurantAddress = orderWithUser.restaurantId.address || orderWithUser.restaurantId.location?.formattedAddress || orderWithUser.restaurantId.location?.address || 'Restaurant address';
        restaurantLocation = orderWithUser.restaurantId.location;
      } else {
        // If restaurantId is just an ID, fetch restaurant details
        try {
          const RestaurantModel = await import('../../restaurant/models/Restaurant.js');
          const restaurant = await RestaurantModel.default.findById(orderWithUser.restaurantId).select('name address location').lean();
          if (restaurant) {
            restaurantAddress = restaurant.address || restaurant.location?.formattedAddress || restaurant.location?.address || 'Restaurant address';
            restaurantLocation = restaurant.location;
          }
        } catch (e) {
          console.warn('⚠️ Could not fetch restaurant details for notification:', e.message);
        }
      }
    }

    // Calculate delivery distance (restaurant to customer) for earnings calculation
    // Keep it aligned with completion payout by preferring pricing snapshot distance.
    const pricingDistanceKm = Number(orderWithUser?.pricing?.distanceKm);
    let deliveryDistance = Number.isFinite(pricingDistanceKm) && pricingDistanceKm > 0 ? pricingDistanceKm : 0;
    if (!(deliveryDistance > 0) && restaurantLocation?.coordinates && orderWithUser.address?.location?.coordinates) {
      const [restaurantLng, restaurantLat] = restaurantLocation.coordinates;
      const [customerLng, customerLat] = orderWithUser.address.location.coordinates;

      // Validate coordinates
      if (restaurantLat && restaurantLng && customerLat && customerLng && !isNaN(restaurantLat) && !isNaN(restaurantLng) && !isNaN(customerLat) && !isNaN(customerLng)) {
        // Calculate distance using Haversine formula
        const R = 6371; // Earth radius in km
        const dLat = (customerLat - restaurantLat) * Math.PI / 180;
        const dLng = (customerLng - restaurantLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(restaurantLat * Math.PI / 180) * Math.cos(customerLat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        deliveryDistance = R * c;
      } else {
        console.warn('⚠️ Invalid coordinates for distance calculation');
      }
    } else {
      if (!(deliveryDistance > 0)) {
        console.warn('⚠️ Missing coordinates for distance calculation');
      }
    }

    // Calculate estimated earnings based on delivery distance
    let estimatedEarnings = null;
    const deliveryFeeFromOrder = orderWithUser.pricing?.deliveryFee ?? 0;
    const adminDeliveryCost = orderWithUser?.pricing?.adminDeliveryCost ?? deliveryFeeFromOrder;
    const tierName = orderWithUser?.pricing?.pricingMeta?.tierName || null;
    let adminRetentionPercent = 0;
    if (tierName) {
      try {
        const Tier = (await import('../../admin/models/Tier.js')).default;
        const tierDoc = await Tier.findOne({ name: tierName }).select('deliveryPricing.adminRetentionPercent').lean();
        adminRetentionPercent = clampPercent(tierDoc?.deliveryPricing?.adminRetentionPercent ?? 0);
      } catch (tierLookupError) {
        console.error('Error resolving tier retention for multi-notify earnings:', tierLookupError.message);
      }
    }
    try {
      estimatedEarnings = await calculateEstimatedEarnings(
        deliveryDistance,
        tierName,
        adminDeliveryCost,
        adminRetentionPercent
      );
      const earnedValue = typeof estimatedEarnings === 'object' ? estimatedEarnings.totalEarning ?? 0 : Number(estimatedEarnings) || 0;
      if (!(earnedValue > 0)) {
        // keep zero when commission result is zero; do not override from customer delivery fee
      }
    } catch (earningsError) {
      console.error('❌ Error calculating estimated earnings in notification:', earningsError);
      console.error('❌ Error stack:', earningsError.stack);
      estimatedEarnings = {
        basePayout: 0,
        distance: deliveryDistance,
        commissionPerKm: 0,
        distanceCommission: 0,
        totalEarning: 0,
        breakdown: {
          basePayout: 0,
          distance: deliveryDistance,
          commissionPerKm: 0,
          distanceCommission: 0,
          minDistance: 0
        }
      };
    }

    // Prepare notification payload
    const orderNotification = {
      orderId: orderWithUser.orderId || orderWithUser._id,
      mongoId: orderWithUser._id?.toString(),
      orderMongoId: orderWithUser._id?.toString(),
      // Also include orderMongoId for compatibility
      status: orderWithUser.status || 'preparing',
      restaurantName: orderWithUser.restaurantName || orderWithUser.restaurantId?.name,
      restaurantAddress: restaurantAddress,
      restaurantLocation: restaurantLocation ? {
        latitude: restaurantLocation.coordinates?.[1],
        longitude: restaurantLocation.coordinates?.[0],
        address: restaurantLocation.formattedAddress || restaurantLocation.address || restaurantAddress,
        formattedAddress: restaurantLocation.formattedAddress || restaurantLocation.address || restaurantAddress
      } : null,
      customerName: order?.customerName?.trim() || orderWithUser.userId?.name || 'Customer',
      customerPhone: order?.customerPhone?.trim() || orderWithUser.userId?.phone || '',
      deliveryAddress: orderWithUser.address?.address || orderWithUser.address?.location?.address || orderWithUser.address?.formattedAddress,
      customerLocation: orderWithUser.address?.location ? {
        latitude: orderWithUser.address.location.coordinates?.[1],
        longitude: orderWithUser.address.location.coordinates?.[0],
        address: orderWithUser.address.formattedAddress || orderWithUser.address.address
      } : null,
      totalAmount: orderWithUser.pricing?.total || 0,
      deliveryFee: deliveryFeeFromOrder,
      estimatedEarnings: estimatedEarnings,
      // Include calculated earnings
      deliveryDistance: deliveryDistance > 0 ? `${deliveryDistance.toFixed(2)} km` : 'Calculating...',
      paymentMethod: orderWithUser.payment?.method || 'cash',
      message: `New order available: ${orderWithUser.orderId || orderWithUser._id}`,
      timestamp: new Date().toISOString(),
      phase: phase,
      // 'priority' or 'expanded'
      // Include restaurant coordinates
      restaurantLat: restaurantLocation?.coordinates?.[1] || orderWithUser.restaurantId?.location?.coordinates?.[1],
      restaurantLng: restaurantLocation?.coordinates?.[0] || orderWithUser.restaurantId?.location?.coordinates?.[0],
      // Include delivery coordinates
      deliveryLat: orderWithUser.address?.location?.coordinates?.[1] || orderWithUser.address?.location?.latitude,
      deliveryLng: orderWithUser.address?.location?.coordinates?.[0] || orderWithUser.address?.location?.longitude,
      // Include full order for frontend use
      fullOrder: orderWithUser
    };

    console.log('🧭 [CoordDebug][Dispatch][OrderPayload]', {
      orderId: orderNotification.orderId,
      orderMongoId: orderNotification.orderMongoId,
      phase,
      restaurantLocation: orderNotification.restaurantLocation,
      customerLocation: orderNotification.customerLocation,
      restaurantLat: orderNotification.restaurantLat,
      restaurantLng: orderNotification.restaurantLng,
      deliveryLat: orderNotification.deliveryLat,
      deliveryLng: orderNotification.deliveryLng
    });
    // Notify each delivery partner
    for (const deliveryPartnerId of deliveryPartnerIds) {
      try {
        const normalizedId = deliveryPartnerId?.toString() || deliveryPartnerId;
        const roomVariations = [`delivery:${normalizedId}`, `delivery:${deliveryPartnerId}`, ...(mongoose.Types.ObjectId.isValid(normalizedId) ? [`delivery:${new mongoose.Types.ObjectId(normalizedId).toString()}`] : [])];
        let notificationSent = false;
        for (const room of roomVariations) {
          if (!socketAvailable) break;
          const { sockets } = await fetchSocketsInAnyDeliveryEmitter(io, room);
          if (sockets.length > 0) {
            emitToDeliveryRoomAll(io, room, 'new_order', orderNotification);
            emitToDeliveryRoomAll(io, room, 'new_order_available', orderNotification);
            emitToDeliveryRoomAll(io, room, 'play_notification_sound', {
              type: 'new_order_available',
              orderId: order.orderId,
              message: `New order available: ${order.orderId}`,
              phase: phase
            });
            notificationSent = true;
            notifiedCount++;
            break;
          }
        }
        if (!notificationSent && socketAvailable) {
          console.warn(`⚠️ Delivery partner ${normalizedId} not connected, but will receive notification when they connect`);
          // Still emit to room for when they connect
          roomVariations.forEach(room => {
            emitToDeliveryRoomAll(io, room, 'new_order', orderNotification);
            emitToDeliveryRoomAll(io, room, 'new_order_available', orderNotification);
          });
          notifiedCount++;
        } else if (!socketAvailable) {
          notifiedCount++;
        }

        // Always send FCM push for multi-notify so riders get it even if Socket.IO is flaky (e.g. WebView).
        try {
          await sendNotificationToUser(normalizedId, 'delivery', 'New Order Available', `Order #${orderWithUser.orderId} from ${orderNotification.restaurantName || 'restaurant'}`, {
            orderId: orderWithUser.orderId,
            orderMongoId: orderWithUser._id?.toString(),
            status: orderWithUser.status,
            type: 'new_order_available',
            clickUrl: `/delivery?orderId=${orderWithUser._id?.toString()}`,
            phase,
            notificationPriority: 'high',
            templateKey: 'delivery_new_order_available',
            templateVars: {
              orderId: orderWithUser.orderId,
              restaurantName: orderNotification.restaurantName || 'restaurant'
            }
          });
        } catch (pushError) {
          console.error('❌ [FCM] Error sending delivery new_order_available notification:', pushError);
        }
      } catch (partnerError) {
        console.error(`❌ Error notifying delivery partner ${deliveryPartnerId}:`, partnerError);
      }
    }
    return {
      success: true,
      notified: notifiedCount
    };
  } catch (error) {
    console.error('❌ Error notifying multiple delivery boys:', error);
    return {
      success: false,
      notified: 0
    };
  }
}

/**
 * Notify delivery partners that an order is no longer available (taken by someone else).
 * Frontend listens to `order_taken` to auto-dismiss the offer popup.
 * @param {{orderMongoId: string, orderId: string, acceptedBy?: string}} data
 * @param {Array<string>} deliveryPartnerIds
 */
export async function notifyDeliveryPartnersOrderTaken(data, deliveryPartnerIds = []) {
  try {
    if (!data?.orderMongoId && !data?.orderId) return;
    if (!Array.isArray(deliveryPartnerIds) || deliveryPartnerIds.length === 0) return;

    const io = await getIOInstance();
    if (!io) return;

    const payload = {
      orderMongoId: data?.orderMongoId || null,
      orderId: data?.orderId || null,
      acceptedBy: data?.acceptedBy || null,
      timestamp: new Date().toISOString()
    };

    const uniqueIds = Array.from(new Set(deliveryPartnerIds.map(id => id?.toString?.() || String(id || '')).filter(Boolean)));
    for (const deliveryPartnerId of uniqueIds) {
      const rooms = buildDeliveryRoomVariations(deliveryPartnerId, null);
      rooms.forEach(room => {
        emitToDeliveryRoomAll(io, room, 'order_taken', payload);
      });
    }
  } catch (error) {
    console.error('❌ Error emitting order_taken to delivery partners:', error);
  }
}

/**
 * Notify delivery boy that order is ready for pickup
 * @param {Object} order - Order document
 * @param {string} deliveryPartnerId - Delivery partner ID
 */
export async function notifyDeliveryBoyOrderReady(order, deliveryPartnerId) {
  try {
    const io = await getIOInstance();
    const socketAvailable = Boolean(io);
    if (!socketAvailable) {
      console.warn('Socket.IO not initialized, skipping delivery socket notification but continuing with push.');
    }
    const normalizedDeliveryPartnerId = deliveryPartnerId?.toString() || deliveryPartnerId;

    // Prepare order ready notification
    const coords = order.restaurantId?.location?.coordinates;
    const orderReadyNotification = {
      orderId: order.orderId || order._id,
      mongoId: order._id?.toString(),
      status: 'ready',
      restaurantName: order.restaurantName || order.restaurantId?.name,
      restaurantAddress: order.restaurantId?.address || order.restaurantId?.location?.address,
      message: `Order ${order.orderId} is ready for pickup`,
      timestamp: new Date().toISOString(),
      // Include restaurant coords so delivery app can show Reached Pickup when rider is near (coordinates: [lng, lat])
      restaurantLat: coords?.[1],
      restaurantLng: coords?.[0]
    };

    // Try to find delivery partner's room
    const roomVariations = [`delivery:${normalizedDeliveryPartnerId}`, `delivery:${deliveryPartnerId}`, ...(mongoose.Types.ObjectId.isValid(normalizedDeliveryPartnerId) ? [`delivery:${new mongoose.Types.ObjectId(normalizedDeliveryPartnerId).toString()}`] : [])];
    let notificationSent = false;
    let foundRoom = null;
    let socketsInRoom = [];
    if (socketAvailable) {
      for (const room of roomVariations) {
        const { sockets } = await fetchSocketsInAnyDeliveryEmitter(io, room);
        if (sockets.length > 0) {
          foundRoom = room;
          socketsInRoom = sockets;
          break;
        }
      }
    }
    if (socketAvailable && foundRoom && socketsInRoom.length > 0) {
      // Send to specific delivery partner room
      emitToDeliveryRoomAll(io, foundRoom, 'order_ready', orderReadyNotification);
      notificationSent = true;
    } else {
      // Fallback: broadcast to all delivery sockets
      console.warn(`⚠️ Delivery partner ${normalizedDeliveryPartnerId} not found in any room, broadcasting to all`);
      emitToAllDeliverySockets(io, 'order_ready', orderReadyNotification);
      notificationSent = true;
    }

    // Send FCM push to delivery partner (always send)
    try {
      await sendNotificationToUser(normalizedDeliveryPartnerId, 'delivery', 'Order Ready for Pickup', `Order #${order.orderId} is ready for pickup`, {
        orderId: order.orderId,
        orderMongoId: order._id?.toString(),
        status: 'ready',
        type: 'order_ready',
        notificationPriority: 'high',
        templateKey: 'delivery_order_ready_for_pickup',
        templateVars: {
          orderId: order.orderId
        }
      });
    } catch (pushError) {
      console.error('❌ [FCM] Error sending delivery order ready notification:', pushError);
    }
    return {
      success: notificationSent,
      deliveryPartnerId: normalizedDeliveryPartnerId,
      orderId: order.orderId
    };
  } catch (error) {
    console.error('Error notifying delivery boy about order ready:', error);
    throw error;
  }
}

/**
 * Notify delivery partner about lifecycle status updates for accepted orders.
 * @param {string} deliveryPartnerId
 * @param {Object} order
 * @param {string} status
 */
export async function notifyDeliveryOrderLifecycle(deliveryPartnerId, order, status) {
  try {
    const normalizedDeliveryPartnerId = deliveryPartnerId?.toString?.() || String(deliveryPartnerId || '');
    if (!normalizedDeliveryPartnerId) return;

    const normalizedStatus = String(status || '').toLowerCase();
    const orderNumber = order?.orderId || order?._id?.toString?.() || 'order';

    let title = 'Order Update';
    let body = `Order #${orderNumber} status is now ${normalizedStatus}`;
    let type = 'delivery_order_update';

    if (normalizedStatus === 'accepted') {
      title = 'Order Accepted';
      body = `You accepted Order #${orderNumber}`;
      type = 'delivery_order_accepted';
    } else if (normalizedStatus === 'confirmed') {
      title = 'Order Confirmed';
      body = `Order #${orderNumber} has been confirmed`;
      type = 'delivery_order_confirmed';
    } else if (normalizedStatus === 'preparing') {
      title = 'Order Preparing';
      body = `Order #${orderNumber} is being prepared`;
      type = 'delivery_order_preparing';
    } else if (normalizedStatus === 'out_for_delivery') {
      title = 'Out for Delivery';
      body = `Order #${orderNumber} is now out for delivery`;
      type = 'delivery_order_out_for_delivery';
    } else if (normalizedStatus === 'delivered') {
      title = 'Order Delivered';
      body = `Order #${orderNumber} marked as delivered`;
      type = 'delivery_order_delivered';
    } else if (normalizedStatus === 'cancelled') {
      title = 'Order Cancelled';
      body = `Order #${orderNumber} was cancelled`;
      type = 'delivery_order_cancelled';
    } else if (normalizedStatus === 'reassigned') {
      title = 'Order Reassigned';
      body = `Order #${orderNumber} was reassigned`;
      type = 'delivery_order_reassigned';
    }

    await sendNotificationToUser(normalizedDeliveryPartnerId, 'delivery', title, body, {
      orderId: order?.orderId || null,
      orderMongoId: order?._id?.toString?.() || null,
      status: normalizedStatus,
      type
    });
  } catch (error) {
    console.error('❌ [FCM] Error sending delivery lifecycle notification:', error);
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

const roundCurrency = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return numeric;
};
const calculateDeliverySplit = (adminDeliveryCost, adminRetentionPercent) => {
  const normalizedCost = Math.max(0, Number(adminDeliveryCost) || 0);
  const retention = clampPercent(adminRetentionPercent);
  let adminRetained = roundCurrency(normalizedCost * (retention / 100));
  let deliveryPartnerShare = roundCurrency(normalizedCost - adminRetained);
  if (deliveryPartnerShare < 0) {
    deliveryPartnerShare = 0;
    adminRetained = roundCurrency(normalizedCost);
  }
  const delta = roundCurrency(normalizedCost - (adminRetained + deliveryPartnerShare));
  if (delta !== 0) {
    deliveryPartnerShare = roundCurrency(deliveryPartnerShare + delta);
  }
  return {
    adminRetentionPercent: retention,
    adminRetainedDelivery: adminRetained,
    deliveryPartnerShare
  };
};

/**
 * Calculate estimated earnings for delivery boy based on admin commission rules (net of admin retention).
 * Rule: payout is either base slab OR per-km slab as resolved by DeliveryBoyCommission.
 */
async function calculateEstimatedEarnings(deliveryDistance, tierName = null, adminDeliveryCost = 0, adminRetentionPercent = 0) {
  try {
    const DeliveryBoyCommission = (await import('../../admin/models/DeliveryBoyCommission.js')).default;

    // Always use calculateCommission method which handles all cases including distance = 0
    // It will return base payout even if distance is 0
    const deliveryDistanceForCalc = deliveryDistance || 0;
    const commissionResult = await DeliveryBoyCommission.calculateCommission(
      deliveryDistanceForCalc,
      tierName
    );

    // If distance is 0 or not provided, payout remains 0 (0 km excluded from payout range)
    if (!deliveryDistance || deliveryDistance <= 0) {
      return {
        basePayout: 0,
        distance: 0,
        commissionPerKm: 0,
        distanceCommission: 0,
        totalEarning: 0,
        breakdown: 'No payout for 0 km distance',
        minDistance: commissionResult.breakdown?.minDistance ?? 0,
        maxDistance: commissionResult.breakdown?.maxDistance ?? 0
      };
    }

    // Use the already calculated commissionResult for distance > 0

    const basePayout = commissionResult.breakdown.basePayout;
    const distance = deliveryDistance;
    const commissionPerKm = commissionResult.breakdown.commissionPerKm;
    const distanceCommission = commissionResult.breakdown.distanceCommission;
    const split = calculateDeliverySplit(adminDeliveryCost, adminRetentionPercent);
    const totalEarning = split.deliveryPartnerShare;

    // Create breakdown text
    let breakdown = `Base payout: ₹${basePayout}`;
    if (commissionResult.breakdown?.perKmApplied) {
      breakdown += ` + Distance (${distance.toFixed(1)} km × ₹${commissionPerKm}/km) = ₹${distanceCommission.toFixed(0)}`;
    } else {
      breakdown += ` (Distance ${distance.toFixed(1)} km within base slab up to ${commissionResult.breakdown.maxDistance} km, per km not applicable)`;
    }
    breakdown += ` = ₹${totalEarning.toFixed(0)}`;
    return {
      basePayout: Math.round(basePayout * 100) / 100,
      distance: Math.round(distance * 100) / 100,
      commissionPerKm: Math.round(commissionPerKm * 100) / 100,
      distanceCommission: Math.round(distanceCommission * 100) / 100,
      totalEarning: Math.round(totalEarning * 100) / 100,
      breakdown: breakdown,
      minDistance: commissionResult.rule.minDistance,
      maxDistance: commissionResult.rule.maxDistance,
      adminRetentionPercent: split.adminRetentionPercent,
      adminRetainedDelivery: split.adminRetainedDelivery
    };
  } catch (error) {
    console.error('Error calculating estimated earnings:', error);
    // Strict fallback: do not invent base+distance payout when rule resolution fails.
    return {
      basePayout: 0,
      distance: deliveryDistance || 0,
      commissionPerKm: 0,
      distanceCommission: 0,
      totalEarning: 0,
      breakdown: 'Commission rule unavailable',
      minDistance: 0,
      maxDistance: 0
    };
  }
}
