import Delivery from '../../delivery/models/Delivery.js';
import Order from '../models/Order.js';
import Zone from '../../admin/models/Zone.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';
import BusinessSettings from '../../admin/models/BusinessSettings.js';
import mongoose from 'mongoose';
import { notifyDeliveryBoyNewOrder, checkDeliveryPartnerConnection, notifyMultipleDeliveryBoys } from './deliveryNotificationService.js';
import { notifyRestaurantOrderMessage } from './restaurantNotificationService.js';

const ASSIGNMENT_TIMEOUT_MS = 300000; // 5 minutes to accept
const assignmentTimeouts = new Map();
const FIREBASE_ONLINE_TTL_MS = Number(process.env.DELIVERY_ONLINE_TTL_MS || 120000); // 2 minutes
const STRICT_SOCKET_ONLINE = String(process.env.DELIVERY_STRICT_SOCKET_ONLINE || 'true') !== 'false';
const ALLOW_MONGO_ONLINE_FALLBACK = String(process.env.DELIVERY_ALLOW_MONGO_ONLINE_FALLBACK || 'false') === 'true';
const PRESENCE_DEBUG = String(process.env.DELIVERY_PRESENCE_DEBUG || 'true') === 'true';

function clearAssignmentTimeout(orderId) {
  const key = String(orderId);
  const existing = assignmentTimeouts.get(key);
  if (existing) {
    clearTimeout(existing);
    assignmentTimeouts.delete(key);
  }
}

async function autoCancelIfUnassigned(orderId) {
  try {
    const order = await Order.findById(orderId);
    if (!order) return;
    if (order.deliveryPartnerId) return;
    if (order.status === 'cancelled' || order.status === 'delivered') return;
    if (!['confirmed', 'preparing', 'ready'].includes(order.status)) return;
    // Guard against stale timer if order was just notified
    const lastNotifiedAtMs = order.assignmentInfo?.lastNotifiedAt ? new Date(order.assignmentInfo.lastNotifiedAt).getTime() : 0;
    const broadcastNotifiedAtMs = order.assignmentInfo?.broadcastNotifiedAt ? new Date(order.assignmentInfo.broadcastNotifiedAt).getTime() : 0;
    const effectiveNotifiedAtMs = Math.max(lastNotifiedAtMs, broadcastNotifiedAtMs);
    if (!effectiveNotifiedAtMs) {
      console.warn(`⚠️ [DeliveryAssign] Timeout skipped: missing notifiedAt for order ${order.orderId || orderId}`);
      return;
    }
    const elapsedMs = Date.now() - effectiveNotifiedAtMs;
    if (elapsedMs < ASSIGNMENT_TIMEOUT_MS) return;

    // Do NOT auto-cancel orders when no riders accept.
    // Instead, notify the restaurant so they can resend the request.
    const previousNoPartnerAtMs = order.assignmentInfo?.noPartnerNotifiedAt
      ? new Date(order.assignmentInfo.noPartnerNotifiedAt).getTime()
      : 0;
    if (previousNoPartnerAtMs && previousNoPartnerAtMs >= effectiveNotifiedAtMs) {
      return;
    }

    if (!order.assignmentInfo) order.assignmentInfo = {};
    order.assignmentInfo.noPartnerNotifiedAt = new Date();
    order.assignmentInfo.noPartnerReason = 'timeout_no_accept';
    // Clear sequential candidate (if any) so it doesn't keep the order locked.
    order.assignmentInfo.currentCandidateId = null;
    await order.save();

    await notifyRestaurantOrderMessage(order._id.toString(), {
      status: order.status,
      type: 'delivery_assignment_failed',
      message: `No delivery partners accepted Order #${order.orderId}. You can tap Resend to notify nearby delivery partners again.`
    });
  } finally {
    clearAssignmentTimeout(orderId);
  }
}

function scheduleAssignmentTimeout(orderId) {
  clearAssignmentTimeout(orderId);
  const timeoutId = setTimeout(() => autoCancelIfUnassigned(orderId), ASSIGNMENT_TIMEOUT_MS);
  assignmentTimeouts.set(String(orderId), timeoutId);
}

function isFirebaseOnlineEntry(data) {
  const statusRaw = data?.status ?? data?.isOnline ?? '';
  const status = String(statusRaw).toLowerCase();
  const isOnline = status === 'online' || status === 'true' || status === '1' || data?.isOnline === true;
  if (!isOnline) return false;

  const ts = Number(data?.last_updated ?? data?.lastUpdate ?? data?.updatedAt ?? 0);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const age = Date.now() - ts;
  return age >= 0 && age <= FIREBASE_ONLINE_TTL_MS;
}

async function filterConnectedPartners(partners, orderTag = '') {
  if (!STRICT_SOCKET_ONLINE || !Array.isArray(partners) || partners.length === 0) return partners || [];
  const connected = [];
  for (const partner of partners) {
    const partnerId = partner?._id?.toString ? partner._id.toString() : String(partner?._id || '');
    if (!partnerId) continue;
    const connection = await checkDeliveryPartnerConnection(partnerId);
    if (connection?.connected) {
      connected.push(partner);
    }
  }
  if (connected.length !== partners.length) {
    console.warn('⚠️ [DeliveryAssign] Filtered disconnected riders from candidate list', {
      order: orderTag || null,
      before: partners.length,
      after: connected.length
    });
  }
  return connected;
}

async function getRiderPresenceSnapshot(deliveryPartnerId) {
  const riderId = deliveryPartnerId?.toString?.() || String(deliveryPartnerId || '');
  const snapshot = {
    riderId,
    db: {
      exists: false,
      isOnline: false,
      isActive: false,
      status: null,
      lastLocationUpdate: null
    },
    firebase: {
      exists: false,
      status: null,
      isOnlineRaw: null,
      isOnlineDerived: false,
      lastUpdated: null,
      lastUpdatedAgeMs: null,
      freshByTtl: false
    },
    socket: {
      connected: false,
      room: null,
      socketCount: 0
    }
  };

  try {
    const rider = await Delivery.findById(riderId)
      .select('isActive status availability.isOnline availability.lastLocationUpdate')
      .lean();
    if (rider) {
      snapshot.db.exists = true;
      snapshot.db.isOnline = Boolean(rider?.availability?.isOnline);
      snapshot.db.isActive = Boolean(rider?.isActive);
      snapshot.db.status = rider?.status || null;
      snapshot.db.lastLocationUpdate = rider?.availability?.lastLocationUpdate || null;
    }
  } catch (dbErr) {
    snapshot.db.error = dbErr?.message || 'db_lookup_failed';
  }

  try {
    const { getDb } = await import('../../../config/firebaseConfig.js');
    const db = getDb();
    const fbSnap = await db.ref(`delivery_boys/${riderId}`).once('value');
    const data = fbSnap.val();
    if (data) {
      const statusRaw = data?.status ?? data?.isOnline ?? '';
      const status = String(statusRaw).toLowerCase();
      const isOnline = status === 'online' || status === 'true' || status === '1' || data?.isOnline === true;
      const lastUpdated = Number(data?.last_updated ?? data?.lastUpdate ?? data?.updatedAt ?? 0);
      const ageMs = Number.isFinite(lastUpdated) && lastUpdated > 0 ? Date.now() - lastUpdated : null;
      snapshot.firebase.exists = true;
      snapshot.firebase.status = data?.status ?? null;
      snapshot.firebase.isOnlineRaw = data?.isOnline ?? null;
      snapshot.firebase.isOnlineDerived = isOnline;
      snapshot.firebase.lastUpdated = Number.isFinite(lastUpdated) && lastUpdated > 0 ? lastUpdated : null;
      snapshot.firebase.lastUpdatedAgeMs = ageMs;
      snapshot.firebase.freshByTtl = Number.isFinite(ageMs) ? ageMs >= 0 && ageMs <= FIREBASE_ONLINE_TTL_MS : false;
    }
  } catch (fbErr) {
    snapshot.firebase.error = fbErr?.message || 'firebase_lookup_failed';
  }

  try {
    const connection = await checkDeliveryPartnerConnection(riderId);
    snapshot.socket.connected = Boolean(connection?.connected);
    snapshot.socket.room = connection?.room || null;
    snapshot.socket.socketCount = connection?.socketCount || 0;
  } catch (socketErr) {
    snapshot.socket.error = socketErr?.message || 'socket_check_failed';
  }

  return snapshot;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

/**
 * Keep only riders who have no active assigned order.
 * Active order = any order not in delivered/cancelled.
 * @param {Array<Object>} partners
 * @returns {Promise<Array<Object>>}
 */
async function filterIdleDeliveryPartners(partners) {
  if (!Array.isArray(partners) || partners.length === 0) return [];

  const partnerIdStrings = partners
    .map(p => (p?._id?.toString ? p._id.toString() : String(p?._id || '')))
    .filter(Boolean);
  if (partnerIdStrings.length === 0) return [];

  const objectIds = partnerIdStrings
    .filter(id => mongoose.Types.ObjectId.isValid(id))
    .map(id => new mongoose.Types.ObjectId(id));

  const activeOrders = await Order.find({
    // Treat only in-progress delivery statuses as "busy"
    status: { $in: ['confirmed', 'preparing', 'ready', 'out_for_delivery'] },
    $or: [
      { deliveryPartnerId: { $in: partnerIdStrings } },
      ...(objectIds.length > 0 ? [{ deliveryPartnerId: { $in: objectIds } }] : [])
    ]
  }).select('deliveryPartnerId').lean();

  const busyIds = new Set(
    activeOrders
      .map(o => (o?.deliveryPartnerId?.toString ? o.deliveryPartnerId.toString() : String(o?.deliveryPartnerId || '')))
      .filter(Boolean)
  );

  return partners.filter(p => {
    const id = p?._id?.toString ? p._id.toString() : String(p?._id || '');
    return id && !busyIds.has(id);
  });
}

/**
 * Find all nearest available delivery boys within priority distance (for priority notification)
 * @param {number} restaurantLat - Restaurant latitude
 * @param {number} restaurantLng - Restaurant longitude
 * @param {string} restaurantId - Restaurant ID (for zone lookup)
 * @param {number} priorityDistance - Priority distance in km (default: 5km)
 * @returns {Promise<Array>} Array of delivery boys within priority distance
 */
export async function findNearestDeliveryBoys(restaurantLat, restaurantLng, restaurantId = null, priorityDistance = 5) {
  try {
    // Use the same logic as findNearestDeliveryBoy but return all within priority distance
    let zone = null;
    let deliveryQuery = {
      'availability.isOnline': true,
      status: {
        $in: ['approved', 'active']
      },
      isActive: true,
      'availability.currentLocation.coordinates': {
        $exists: true,
        $ne: [0, 0]
      }
    };
    if (restaurantId) {
      try {
        const restaurantIdObj = restaurantId.toString ? restaurantId.toString() : restaurantId;
        zone = await Zone.findOne({
          restaurantId: restaurantIdObj,
          isActive: true
        }).lean();
        if (zone) {}
      } catch (zoneError) {
        console.warn(`⚠️ Error finding zone:`, zoneError.message);
      }
    }
    let boysData = {};
    try {
      const { getDb } = await import('../../../config/firebaseConfig.js');
      const db = getDb();
      // Read from Firebase Realtime DB
      const boysSnapshot = await db.ref('delivery_boys').once('value');
      boysData = boysSnapshot.val() || {};
    } catch (firebaseError) {
      // Non-fatal: we can still fall back to MongoDB online riders.
      console.warn('⚠️ [DeliveryAssign] Firebase presence unavailable; falling back to Mongo rider lookup:', firebaseError.message);
      boysData = {};
    }

    // Convert to array and filter online (be resilient to string coords)
    let deliveryPartners = Object.entries(boysData)
      .filter(([id, data]) => isFirebaseOnlineEntry(data))
      .map(([id, data]) => {
        const idStr = String(id);
        const lat = Number(data?.lat);
        const lng = Number(data?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const objectId = mongoose.Types.ObjectId.isValid(idStr) ? new mongoose.Types.ObjectId(idStr) : null;
        return {
          _id: objectId || idStr,
          _idStr: idStr,
          availability: {
            currentLocation: {
              coordinates: [lng, lat]
            }
          }
        };
      })
      .filter(Boolean);

    // Fetch names and zones from MongoDB to augment Firebase data (do not hard-drop if not found)
    if (deliveryPartners.length > 0) {
      const ids = deliveryPartners
        .map(p => (p?._idStr && mongoose.Types.ObjectId.isValid(p._idStr) ? new mongoose.Types.ObjectId(p._idStr) : null))
        .filter(Boolean);
      const dbPartners = await Delivery.find({
        ...(ids.length > 0
          ? { _id: { $in: ids } }
          : { _id: { $in: [] } }),
        isActive: true,
        status: {
          $in: ['approved', 'active']
        }
      }).select('_id name phone zoneId').lean();
      const dbPartnerMap = dbPartners.reduce((acc, p) => {
        acc[p._id.toString()] = p;
        return acc;
      }, {});
      deliveryPartners = deliveryPartners.map(p => {
        const key = p?._idStr || (p?._id?.toString ? p._id.toString() : String(p?._id || ''));
        const dbInfo = dbPartnerMap[key];
        if (!dbInfo) {
          console.warn(`⚠️ [DeliveryAssign] No DB match for delivery boy ${key}. Using Firebase-only data.`);
        }
        return {
          ...p,
          ...(dbInfo || {})
        };
      });
    }
    if (ALLOW_MONGO_ONLINE_FALLBACK) {
      const firebasePartnerIds = new Set(
        deliveryPartners
          .map(p => p?._idStr || (p?._id?.toString ? p._id.toString() : String(p?._id || '')))
          .filter(Boolean)
      );
      const mongoOnlyPartners = await Delivery.find({
        isActive: true,
        status: { $in: ['approved', 'active'] },
        'availability.isOnline': true,
        'availability.currentLocation.coordinates': { $exists: true, $ne: [0, 0] }
      }).select('_id name phone zoneId availability.currentLocation').lean();

      for (const partner of mongoOnlyPartners) {
        const key = partner?._id?.toString?.() || String(partner?._id || '');
        if (!key || firebasePartnerIds.has(key)) continue;
        deliveryPartners.push({
          ...partner,
          _idStr: key
        });
      }
    }
    const preIdleFilterPartners = deliveryPartners;
    const idlePartners = await filterIdleDeliveryPartners(deliveryPartners);
    if (Array.isArray(idlePartners) && idlePartners.length > 0) {
      const idleIds = new Set(
        idlePartners
          .map(p => p?._idStr || (p?._id?.toString ? p._id.toString() : String(p?._id || '')))
          .filter(Boolean)
      );
      const deferredBusyPartners = preIdleFilterPartners.filter(p => {
        const key = p?._idStr || (p?._id?.toString ? p._id.toString() : String(p?._id || ''));
        return key && !idleIds.has(key);
      });
      deliveryPartners = [...idlePartners, ...deferredBusyPartners];
    } else {
      deliveryPartners = idlePartners;
    }
    if (!deliveryPartners || deliveryPartners.length === 0) {
      if (Array.isArray(preIdleFilterPartners) && preIdleFilterPartners.length > 0) {
        console.warn('⚠️ [DeliveryAssign] All partners filtered as busy. Proceeding without idle filter for this assignment.');
        deliveryPartners = preIdleFilterPartners;
      }
    }

    // Calculate distance and filter
    const effectivePriorityDistance = Number(priorityDistance || 0) + 0.5; // small GPS tolerance
    let deliveryPartnersWithDistance = deliveryPartners.map(partner => {
      const location = partner.availability?.currentLocation;
      if (!location || !location.coordinates || location.coordinates.length < 2) {
        return null;
      }
      const [lng, lat] = location.coordinates;
      if (lat === 0 && lng === 0) {
        return null;
      }

      // Zone filtering - RELAXED: Removed strict zone matching for range-based priority
      /*
      if (zone) {
         // ...
      }
      */

      const distance = calculateDistance(restaurantLat, restaurantLng, lat, lng);
      return {
        ...partner,
        distance,
        latitude: lat,
        longitude: lng,
        zoneId: partner.zoneId || null
      };
    }).filter(partner => partner !== null && Number.isFinite(partner.distance) && partner.distance <= effectivePriorityDistance).sort((a, b) => a.distance - b.distance);

    if (deliveryPartners.length > 0 && deliveryPartnersWithDistance.length === 0) {
      try {
        const sample = deliveryPartners.slice(0, 5).map(p => {
          const coords = p?.availability?.currentLocation?.coordinates || [];
          const [lng, lat] = coords;
          const dist = Number.isFinite(lat) && Number.isFinite(lng)
            ? calculateDistance(restaurantLat, restaurantLng, lat, lng)
            : null;
          return {
            id: p?._idStr || (p?._id?.toString ? p._id.toString() : String(p?._id || '')),
            lat,
            lng,
            dist
          };
        });
        console.warn('⚠️ [DeliveryAssign] All candidates filtered out. Debug:', {
          restaurantLat,
          restaurantLng,
          priorityDistance,
          sample
        });
      } catch {}
    }
    // Fallback to MongoDB location data if Firebase-based list is empty
    if (deliveryPartnersWithDistance.length === 0) {
      const fallbackPartners = await Delivery.find({
        isActive: true,
        status: { $in: ['approved', 'active'] },
        'availability.isOnline': true,
        'availability.currentLocation.coordinates': { $exists: true, $ne: [0, 0] }
      }).select('_id name phone availability.currentLocation').lean();

      deliveryPartnersWithDistance = (fallbackPartners || []).map(partner => {
        const coords = partner?.availability?.currentLocation?.coordinates || [];
        const [lng, lat] = coords;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const distance = calculateDistance(restaurantLat, restaurantLng, lat, lng);
        return {
          ...partner,
          distance,
          latitude: lat,
          longitude: lng,
          zoneId: partner.zoneId || null
        };
      }).filter(p => p && Number.isFinite(p.distance) && p.distance <= effectivePriorityDistance)
        .sort((a, b) => a.distance - b.distance);
    }

    // IMPORTANT:
    // Do not hard-filter by Socket.IO connection here.
    // In production (e.g. Flutter WebView wraps), sockets can be flaky or room-join may lag,
    // but we still want to notify via FCM and/or deliver when they reconnect.

    return deliveryPartnersWithDistance.map(partner => ({
      deliveryPartnerId: partner._id.toString(),
      name: partner.name,
      phone: partner.phone,
      distance: partner.distance,
      location: {
        latitude: partner.latitude,
        longitude: partner.longitude
      }
    }));
  } catch (error) {
    console.error('❌ Error finding nearest delivery boys:', error);
    return [];
  }
}

/**
 * Find the nearest available delivery boy to a restaurant location (with zone-based filtering)
 * @param {number} restaurantLat - Restaurant latitude
 * @param {number} restaurantLng - Restaurant longitude
 * @param {string} restaurantId - Restaurant ID (for zone lookup)
 * @param {number} maxDistance - Maximum distance in km (default: 50km)
 * @param {Array} excludeIds - Array of delivery partner IDs to exclude (already notified)
 * @returns {Promise<Object|null>} Nearest delivery boy or null
 */
export async function findNearestDeliveryBoy(restaurantLat, restaurantLng, restaurantId = null, maxDistance = 50, excludeIds = []) {
  try {
    // Step 1: Find zone and restaurant for deliveryRange
    let zone = null;
    let restaurant = null;
    if (restaurantId) {
      restaurant = await Restaurant.findById(restaurantId).lean();
      if (restaurant && restaurant.deliveryRange) {
        maxDistance = restaurant.deliveryRange;
      }
    }
    let deliveryQuery = {
      'availability.isOnline': true,
      status: {
        $in: ['approved', 'active']
      },
      isActive: true,
      'availability.currentLocation.coordinates': {
        $exists: true,
        $ne: [0, 0] // Exclude default/null coordinates
      }
    };
    if (restaurantId) {
      try {
        // Try to find zone by restaurantId
        const restaurantIdObj = restaurantId.toString ? restaurantId.toString() : restaurantId;
        zone = await Zone.findOne({
          restaurantId: restaurantIdObj,
          isActive: true
        }).lean();
        if (zone) {
          // Option A: Filter by zoneId if Delivery model has zoneId field
          // Uncomment when zoneId is added to Delivery model
          // deliveryQuery.zoneId = zone._id;

          // Option B: Filter by geo-spatial query (if zone has boundary)
          // This is more complex and slower, but works without modifying Delivery model
          if (zone.boundary && zone.boundary.coordinates) {}
        } else {}
      } catch (zoneError) {
        console.warn(`⚠️ Error finding zone for restaurant ${restaurantId}:`, zoneError.message);
        // Continue with distance-based assignment
      }
    }
    const {
      getDb
    } = await import('../../../config/firebaseConfig.js');
    const db = getDb();

    // Read from Firebase Realtime DB
    const boysSnapshot = await db.ref('delivery_boys').once('value');
    const boysData = boysSnapshot.val() || {};

    // Convert to array and filter online (be resilient to string coords)
    let deliveryPartners = Object.entries(boysData)
      .filter(([id, data]) => isFirebaseOnlineEntry(data))
      .map(([id, data]) => {
        const idStr = String(id);
        const lat = Number(data?.lat);
        const lng = Number(data?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const objectId = mongoose.Types.ObjectId.isValid(idStr) ? new mongoose.Types.ObjectId(idStr) : null;
        return {
          _id: objectId || idStr,
          _idStr: idStr,
          availability: {
            currentLocation: {
              coordinates: [lng, lat]
            }
          }
        };
      })
      .filter(Boolean);

    // Fetch names and zones from MongoDB to augment Firebase data
    if (deliveryPartners.length > 0) {
      const ids = deliveryPartners
        .map(p => (p?._idStr && mongoose.Types.ObjectId.isValid(p._idStr) ? new mongoose.Types.ObjectId(p._idStr) : null))
        .filter(Boolean);
      // Construct the MongoDB query combining Firebase online drivers with standard DB filtering
      const finalDbQuery = {
        ...(ids.length > 0
          ? { _id: { $in: ids } }
          : { _id: { $in: [] } }),
        isActive: true,
        status: {
          $in: ['approved', 'active']
        }
      };
      if (excludeIds && excludeIds.length > 0) {
        const excludeObjectIds = excludeIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
        if (excludeObjectIds.length > 0) {
          finalDbQuery._id.$nin = excludeObjectIds;
        }
      }
      const dbPartners = await Delivery.find(finalDbQuery).select('_id name phone zoneId').lean();
      const dbPartnerMap = dbPartners.reduce((acc, p) => {
        acc[p._id.toString()] = p;
        return acc;
      }, {});
      deliveryPartners = deliveryPartners.map(p => {
        const key = p?._idStr || (p?._id?.toString ? p._id.toString() : String(p?._id || ''));
        const dbInfo = dbPartnerMap[key];
        if (!dbInfo) {
          console.warn(`⚠️ [DeliveryAssign] No DB match for delivery boy ${key}. Using Firebase-only data.`);
        }
        return {
          ...p,
          ...(dbInfo || {})
        };
      });
    }
    if (ALLOW_MONGO_ONLINE_FALLBACK) {
      const firebasePartnerIds = new Set(
        deliveryPartners
          .map(p => p?._idStr || (p?._id?.toString ? p._id.toString() : String(p?._id || '')))
          .filter(Boolean)
      );
      const mongoOnlyPartners = await Delivery.find({
        isActive: true,
        status: { $in: ['approved', 'active'] },
        'availability.isOnline': true,
        'availability.currentLocation.coordinates': { $exists: true, $ne: [0, 0] }
      }).select('_id name phone zoneId availability.currentLocation').lean();

      for (const partner of mongoOnlyPartners) {
        const key = partner?._id?.toString?.() || String(partner?._id || '');
        if (!key || firebasePartnerIds.has(key)) continue;
        if (excludeIds && excludeIds.includes(key)) continue;
        deliveryPartners.push({
          ...partner,
          _idStr: key
        });
      }
    }
    const preIdleFilterPartners = deliveryPartners;
    deliveryPartners = await filterIdleDeliveryPartners(deliveryPartners);
    if (!deliveryPartners || deliveryPartners.length === 0) {
      if (Array.isArray(preIdleFilterPartners) && preIdleFilterPartners.length > 0) {
        console.warn('⚠️ [DeliveryAssign] All partners filtered as busy. Proceeding without idle filter for this assignment.');
        deliveryPartners = preIdleFilterPartners;
      } else {
        return null;
      }
    }

    // Calculate distance for each delivery partner and filter by zone if applicable
    const effectiveMaxDistance = Math.min(Number(maxDistance) || 0, 5) + 0.5; // small GPS tolerance
    let deliveryPartnersWithDistance = deliveryPartners.map(partner => {
      const location = partner.availability?.currentLocation;
      if (!location || !location.coordinates || location.coordinates.length < 2) {
        return null;
      }
      const [lng, lat] = location.coordinates; // GeoJSON format: [longitude, latitude]

      // Skip if coordinates are invalid
      if (lat === 0 && lng === 0) {
        return null;
      }

      // Filter by zone if zone exists - RELAXED: Removed strict zone matching
      // We now prioritize range/distance over strict zone boundaries for assignment efficiency
      /*
      if (zone) {
        // ... zone matching logic ...
      }
      */

      const distance = calculateDistance(restaurantLat, restaurantLng, lat, lng);
      return {
        ...partner,
        distance,
        latitude: lat,
        longitude: lng,
        zoneId: partner.zoneId || null
      };
    }).filter(partner => partner !== null && partner.distance <= effectiveMaxDistance).sort((a, b) => a.distance - b.distance); // Sort by distance (nearest first)

    deliveryPartnersWithDistance = await filterConnectedPartners(
      deliveryPartnersWithDistance,
      `findNearestDeliveryBoy:${restaurantId || 'no_restaurant'}`
    );

    if (deliveryPartnersWithDistance.length === 0) {
      return null;
    }

    // Get the nearest delivery partner
    const nearestPartner = deliveryPartnersWithDistance[0];
    return {
      deliveryPartnerId: nearestPartner._id.toString(),
      name: nearestPartner.name,
      phone: nearestPartner.phone,
      distance: nearestPartner.distance,
      location: {
        latitude: nearestPartner.latitude,
        longitude: nearestPartner.longitude
      }
    };
  } catch (error) {
    console.error('❌ Error finding nearest delivery boy:', error);
    throw error;
  }
}

/**
 * Sequentially notify the next delivery partner (one at a time)
 * @param {Object} orderDoc - Order document (mongoose doc)
 * @param {number} restaurantLat
 * @param {number} restaurantLng
 * @returns {Promise<{notified: boolean, deliveryPartnerId?: string}>}
 */
export async function notifyNextDeliveryPartner(orderDoc, restaurantLat, restaurantLng) {
  if (!orderDoc || orderDoc.deliveryPartnerId) {
    return { notified: false };
  }
  const orderId = orderDoc._id;

  // Ensure assignmentInfo exists
  if (!orderDoc.assignmentInfo) orderDoc.assignmentInfo = {};

  // If a candidate is already active (and not rejected), don't advance the queue
  if (orderDoc.assignmentInfo.currentCandidateId) {
    const currentId = orderDoc.assignmentInfo.currentCandidateId?.toString?.() || String(orderDoc.assignmentInfo.currentCandidateId);
    const rejectedSet = new Set((orderDoc.assignmentInfo.rejectedDeliveryPartnerIds || []).map(id => id?.toString?.() || String(id)));
    if (currentId && !rejectedSet.has(currentId)) {
      return { notified: false, deliveryPartnerId: currentId };
    }
  }

  // Build candidate list if not present
  if (!Array.isArray(orderDoc.assignmentInfo.candidateDeliveryPartnerIds) || orderDoc.assignmentInfo.candidateDeliveryPartnerIds.length === 0) {
    const nearest = await findNearestDeliveryBoys(restaurantLat, restaurantLng, orderDoc.restaurantId, 5);
    const candidateIdsRaw = nearest.map(db => db.deliveryPartnerId);

    console.log('🧭 [DeliveryAssign] Candidates (within 5km):', nearest.map(n => ({
      id: n.deliveryPartnerId,
      distanceKm: Number(n.distance?.toFixed?.(2)) || n.distance
    })));
    console.log('🧭 [DeliveryAssign] Candidate queue:', candidateIdsRaw);

    orderDoc.assignmentInfo.candidateDeliveryPartnerIds = candidateIdsRaw;
    orderDoc.assignmentInfo.currentCandidateIndex = -1;
    orderDoc.assignmentInfo.rejectedDeliveryPartnerIds = [];
    orderDoc.assignmentInfo.notificationPhase = 'sequential';
  }

  let candidates = orderDoc.assignmentInfo.candidateDeliveryPartnerIds || [];
  const rejected = new Set(orderDoc.assignmentInfo.rejectedDeliveryPartnerIds || []);
  let idx = Number(orderDoc.assignmentInfo.currentCandidateIndex) || -1;
  const populated = await Order.findById(orderId).populate('userId', 'name phone').populate('restaurantId', 'name address location phone ownerPhone').lean();

  // Move to next connected candidate not rejected
  let nextId = null;
  while (true) {
    for (let i = idx + 1; i < candidates.length; i += 1) {
      const candidateId = candidates[i];
      if (!candidateId || rejected.has(candidateId)) continue;
      nextId = candidateId;
      idx = i;
      break;
    }

    if (!nextId) {
      const refreshedCandidateIds = await refreshSequentialCandidateQueue(orderDoc, restaurantLat, restaurantLng);
      if (refreshedCandidateIds.length > candidates.length) {
        candidates = refreshedCandidateIds;
        continue;
      }

      const fallbackCandidateId = await findNextCandidateByFreshLookup(orderDoc, restaurantLat, restaurantLng, rejected);
      if (fallbackCandidateId) {
        candidates = [...candidates, fallbackCandidateId];
        orderDoc.assignmentInfo.candidateDeliveryPartnerIds = candidates;
        await orderDoc.save();
        continue;
      }
    }

    // If no candidate left, schedule auto-cancel and exit
    if (!nextId) {
      console.warn('⚠️ [DeliveryAssign] No candidates left, scheduling auto-cancel for order', orderDoc.orderId || orderId);
      orderDoc.assignmentInfo.currentCandidateId = null;
      orderDoc.assignmentInfo.lastNotifiedAt = new Date();
      await orderDoc.save();
      scheduleAssignmentTimeout(orderId);
      return { notified: false };
    }

    const codEligible = await canTakeOrderUnderCashLimit(nextId, populated);
    if (!codEligible) {
      console.warn(`⚠️ [DeliveryAssign] Candidate ${nextId} skipped for COD cash-limit on order ${orderDoc.orderId || orderId}`);
      rejected.add(nextId);
      if (!orderDoc.assignmentInfo.rejectedDeliveryPartnerIds) {
        orderDoc.assignmentInfo.rejectedDeliveryPartnerIds = [];
      }
      if (!orderDoc.assignmentInfo.rejectedDeliveryPartnerIds.includes(nextId)) {
        orderDoc.assignmentInfo.rejectedDeliveryPartnerIds.push(nextId);
      }
      nextId = null;
      continue;
    }

    // Skip if delivery partner is not connected to socket
    const connection = await checkDeliveryPartnerConnection(nextId);
    if (PRESENCE_DEBUG) {
      const presence = await getRiderPresenceSnapshot(nextId);
      console.log('🛰️ [DeliveryPresence] Candidate snapshot', {
        orderId: orderDoc.orderId || orderId?.toString?.() || String(orderId),
        candidateId: nextId,
        presence
      });
    }
    console.log('🧪 [DeliveryAssign] Candidate connection check', {
      orderId: orderDoc.orderId || orderId?.toString?.() || String(orderId),
      candidateId: nextId,
      connected: Boolean(connection?.connected),
      room: connection?.room || null,
      socketCount: connection?.socketCount || 0
    });
    if (!connection?.connected) {
      console.warn(`⚠️ [DeliveryAssign] Candidate ${nextId} not connected. Skipping.`);
      if (!orderDoc.assignmentInfo.rejectedDeliveryPartnerIds) {
        orderDoc.assignmentInfo.rejectedDeliveryPartnerIds = [];
      }
      orderDoc.assignmentInfo.rejectedDeliveryPartnerIds.push(nextId);
      nextId = null;
      continue;
    }
    break;
  }

  // Persist current candidate
  orderDoc.assignmentInfo.currentCandidateIndex = idx;
  orderDoc.assignmentInfo.currentCandidateId = nextId;
  orderDoc.assignmentInfo.lastNotifiedAt = new Date();
  await orderDoc.save();

  // Notify only the current candidate
  if (populated) {
    console.log('📤 [DeliveryAssign] Sending notifyDeliveryBoyNewOrder', {
      orderId: populated.orderId || orderDoc.orderId || orderId?.toString?.() || String(orderId),
      selectedCandidateId: nextId,
      currentCandidateIndex: idx
    });
    await notifyDeliveryBoyNewOrder(populated, nextId);
  }
  console.log('✅ [DeliveryAssign] Notified delivery partner:', nextId, 'for order', orderDoc.orderId || orderId);

  scheduleAssignmentTimeout(orderId);
  return { notified: true, deliveryPartnerId: nextId };
}

export function clearAssignmentTimer(orderId) {
  clearAssignmentTimeout(orderId);
}

/**
 * Broadcast an order request to all nearby delivery partners (within 5km).
 * First accept wins; others should get an `order_taken` event from accept handler.
 * @param {string} orderId - MongoDB _id
 * @param {number} restaurantLat
 * @param {number} restaurantLng
 * @param {{trigger?: string}} options
 * @returns {Promise<{success: boolean, notifiedCount: number, deliveryPartnerIds: Array<string>}>}
 */
export async function broadcastDeliveryRequest(orderId, restaurantLat, restaurantLng, { trigger = 'ready' } = {}) {
  const now = new Date();

  const order = await Order.findById(orderId)
    .populate('userId', 'name phone')
    .populate('restaurantId', 'name location address phone ownerPhone')
    .lean();
  if (!order) {
    return { success: false, notifiedCount: 0, deliveryPartnerIds: [] };
  }
  if (order.deliveryPartnerId) {
    return { success: true, notifiedCount: 0, deliveryPartnerIds: [] };
  }
  if (!['confirmed', 'preparing', 'ready'].includes(order.status)) {
    return { success: false, notifiedCount: 0, deliveryPartnerIds: [] };
  }

  const nearest = await findNearestDeliveryBoys(restaurantLat, restaurantLng, order.restaurantId?._id || order.restaurantId, 5);
  const candidateIds = (nearest || []).map(db => db.deliveryPartnerId).filter(Boolean);
  const eligibleIds = await filterByCodCashLimit(candidateIds, order);

  // Reset broadcast tracking + clear sequential fields (if any)
  await Order.findByIdAndUpdate(orderId, {
    $set: {
      'assignmentInfo.notificationPhase': 'broadcast',
      'assignmentInfo.broadcastNotifiedAt': now,
      'assignmentInfo.broadcastDeliveryPartnerIds': eligibleIds,
      'assignmentInfo.broadcastRejectedDeliveryPartnerIds': [],
      'assignmentInfo.lastNotifiedAt': now,
      'assignmentInfo.noPartnerNotifiedAt': null,
      'assignmentInfo.noPartnerReason': null,
      'assignmentInfo.assignedBy': trigger === 'manual_resend' ? 'manual_resend' : (order.assignmentInfo?.assignedBy || 'manual')
    },
    $unset: {
      'assignmentInfo.currentCandidateId': '',
      'assignmentInfo.currentCandidateIndex': '',
      'assignmentInfo.candidateDeliveryPartnerIds': '',
      'assignmentInfo.rejectedDeliveryPartnerIds': ''
    }
  });

  if (!eligibleIds || eligibleIds.length === 0) {
    // No riders nearby/online; notify restaurant immediately.
    await Order.findByIdAndUpdate(orderId, {
      $set: {
        'assignmentInfo.noPartnerNotifiedAt': now,
        'assignmentInfo.noPartnerReason': 'no_candidates'
      }
    });
    await notifyRestaurantOrderMessage(orderId.toString(), {
      status: order.status,
      type: 'delivery_assignment_failed',
      message: `No delivery partners found within 5km for Order #${order.orderId}. You can try Resend again after some time.`
    });
    return { success: true, notifiedCount: 0, deliveryPartnerIds: [] };
  }

  await notifyMultipleDeliveryBoys(order, eligibleIds, 'broadcast');
  scheduleAssignmentTimeout(orderId);
  return { success: true, notifiedCount: eligibleIds.length, deliveryPartnerIds: eligibleIds };
}

async function refreshSequentialCandidateQueue(orderDoc, restaurantLat, restaurantLng) {
  try {
    const currentIds = Array.isArray(orderDoc.assignmentInfo?.candidateDeliveryPartnerIds)
      ? orderDoc.assignmentInfo.candidateDeliveryPartnerIds.map(id => id?.toString()).filter(Boolean)
      : [];
    const latestNearest = await findNearestDeliveryBoys(restaurantLat, restaurantLng, orderDoc.restaurantId, 5);
    const latestIds = latestNearest.map(db => db.deliveryPartnerId?.toString()).filter(Boolean);
    const seen = new Set(currentIds);
    const mergedIds = [...currentIds];

    for (const id of latestIds) {
      if (!seen.has(id)) {
        mergedIds.push(id);
        seen.add(id);
      }
    }

    if (mergedIds.length > currentIds.length) {
      orderDoc.assignmentInfo.candidateDeliveryPartnerIds = mergedIds;
      await orderDoc.save();
      console.log(`🧭 [DeliveryAssign] Refreshed candidate queue for order ${orderDoc.orderId || orderDoc._id}:`, mergedIds);
    }

    return mergedIds;
  } catch (error) {
    console.warn(`⚠️ [DeliveryAssign] Failed to refresh candidate queue for order ${orderDoc.orderId || orderDoc._id}:`, error.message);
    return Array.isArray(orderDoc.assignmentInfo?.candidateDeliveryPartnerIds)
      ? orderDoc.assignmentInfo.candidateDeliveryPartnerIds
      : [];
  }
}

async function findNextCandidateByFreshLookup(orderDoc, restaurantLat, restaurantLng, rejectedSet) {
  try {
    const excludeIds = Array.from(rejectedSet || []).map(id => id?.toString()).filter(Boolean);
    const nextNearest = await findNearestDeliveryBoy(
      restaurantLat,
      restaurantLng,
      orderDoc.restaurantId,
      5,
      excludeIds
    );

    const candidateId = nextNearest?.deliveryPartnerId?.toString();
    if (!candidateId) {
      return null;
    }

    const existing = Array.isArray(orderDoc.assignmentInfo?.candidateDeliveryPartnerIds)
      ? new Set(orderDoc.assignmentInfo.candidateDeliveryPartnerIds.map(id => id?.toString()).filter(Boolean))
      : new Set();

    if (existing.has(candidateId)) {
      return null;
    }

    console.log(`🧭 [DeliveryAssign] Fresh fallback candidate found for order ${orderDoc.orderId || orderDoc._id}: ${candidateId}`);
    return candidateId;
  } catch (error) {
    console.warn(`⚠️ [DeliveryAssign] Fresh fallback lookup failed for order ${orderDoc.orderId || orderDoc._id}:`, error.message);
    return null;
  }
}

async function canTakeOrderUnderCashLimit(deliveryPartnerId, order) {
  if (!deliveryPartnerId || !order) return true;

  const payMethod = (order?.payment?.method || '').toLowerCase().trim();
  if (payMethod !== 'cash' && payMethod !== 'cod') {
    return true;
  }

  const orderTotal = Number(order?.pricing?.total) || 0;
  if (orderTotal <= 0) {
    return true;
  }

  try {
    const [wallet, settings] = await Promise.all([
      DeliveryWallet.findOne({ deliveryId: deliveryPartnerId }).select('cashInHand transactions').lean(),
      BusinessSettings.getSettings()
    ]);

    const cashInHand = getEffectiveCashInHand(wallet);
    const cashLimit = Number(settings?.deliveryCashLimit) || 0;
    if (cashLimit <= 0) {
      return true;
    }

    return cashInHand + orderTotal <= cashLimit;
  } catch (error) {
    console.warn(`⚠️ [DeliveryAssign] Cash-limit check failed for delivery partner ${deliveryPartnerId}:`, error.message);
    return true;
  }
}

function getEffectiveCashInHand(wallet) {
  if (!wallet) return 0;

  const transactions = Array.isArray(wallet.transactions) ? wallet.transactions : [];
  if (transactions.length === 0) {
    return Math.max(0, Number(wallet.cashInHand) || 0);
  }

  let cashInHand = 0;
  for (const t of transactions) {
    if (t?.status !== 'Completed') continue;
    const amount = Number(t.amount) || 0;
    if (t.type === 'payment' || t.type === 'bonus' || t.type === 'refund') {
      if (t.paymentCollected) cashInHand += amount;
    } else if (t.type === 'withdrawal') {
      if (t.paymentCollected) cashInHand -= amount;
    } else if (t.type === 'deduction' || t.type === 'deposit') {
      cashInHand -= amount;
    }
  }

  return Math.max(0, Number.isFinite(cashInHand) ? cashInHand : 0);
}

/**
 * Assign order to nearest delivery boy
 * @param {Object} order - Order document
 * @param {number} restaurantLat - Restaurant latitude
 * @param {number} restaurantLng - Restaurant longitude
 * @returns {Promise<Object|null>} Assignment result or null
 */
export async function assignOrderToDeliveryBoy(order, restaurantLat, restaurantLng, restaurantId = null) {
  try {
    // CRITICAL: Don't assign if order is cancelled
    if (order.status === 'cancelled') {
      return null;
    }

    // CRITICAL: Don't assign if order is already delivered/completed
    if (order.status === 'delivered' || order.deliveryState?.currentPhase === 'completed' || order.deliveryState?.status === 'delivered') {
      return null;
    }

    // Check if order already has a delivery partner assigned
    if (order.deliveryPartnerId) {
      return null;
    }

    // Get restaurantId from order if not provided
    const orderRestaurantId = restaurantId || order.restaurantId;

    // Find nearest delivery boy (with zone-based filtering)
    const nearestDeliveryBoy = await findNearestDeliveryBoy(restaurantLat, restaurantLng, orderRestaurantId);
    if (!nearestDeliveryBoy) {
      return null;
    }

    // Update order with delivery partner assignment
    // Note: Don't set outForDelivery yet - that should happen when delivery boy picks up the order
    order.deliveryPartnerId = nearestDeliveryBoy.deliveryPartnerId;
    order.assignmentInfo = {
      deliveryPartnerId: nearestDeliveryBoy.deliveryPartnerId,
      distance: nearestDeliveryBoy.distance,
      assignedAt: new Date(),
      assignedBy: 'nearest_available'
    };
    // Don't set outForDelivery status here - that should be set when delivery boy picks up the order
    // order.tracking.outForDelivery = {
    //   status: true,
    //   timestamp: new Date()
    // };

    await order.save();

    try {
      const { calculateOrderSettlement } = await import('./orderSettlementService.js');
      await calculateOrderSettlement(order._id);
    } catch (settlementErr) {
      console.error('⚠️ Settlement recalc after auto-assign failed:', settlementErr.message);
    }

    // Trigger ETA recalculation for rider assigned event
    try {
      const etaEventService = (await import('./etaEventService.js')).default;
      await etaEventService.handleRiderAssigned(order._id.toString(), nearestDeliveryBoy.deliveryPartnerId);
    } catch (etaError) {
      console.error('Error updating ETA after rider assignment:', etaError);
      // Continue even if ETA update fails
    }
    return {
      success: true,
      deliveryPartnerId: nearestDeliveryBoy.deliveryPartnerId,
      deliveryPartnerName: nearestDeliveryBoy.name,
      distance: nearestDeliveryBoy.distance,
      orderId: order.orderId
    };
  } catch (error) {
    console.error('❌ Error assigning order to delivery boy:', error);
    throw error;
  }
}

/**
 * Filter out delivery partners whose cashInHand + orderTotal would exceed the cash limit.
 * Only applies to COD orders; non-COD orders return the full list unchanged.
 * @param {Array<string>} deliveryPartnerIds - Array of delivery partner IDs
 * @param {Object} order - Order document (needs payment.method and pricing.total)
 * @returns {Promise<Array<string>>} Filtered delivery partner IDs
 */
export async function filterByCodCashLimit(deliveryPartnerIds, order) {
  if (!deliveryPartnerIds || deliveryPartnerIds.length === 0) return deliveryPartnerIds;

  const payMethod = (order?.payment?.method || '').toLowerCase();
  if (payMethod !== 'cash' && payMethod !== 'cod') return deliveryPartnerIds;

  const orderTotal = Number(order?.pricing?.total) || 0;
  if (orderTotal <= 0) return deliveryPartnerIds;

  try {
    const settings = await BusinessSettings.getSettings();
    const cashLimit = Number(settings?.deliveryCashLimit) || 0;
    if (cashLimit <= 0) return deliveryPartnerIds;

    const objectIds = deliveryPartnerIds
      .map(id => { try { return new mongoose.Types.ObjectId(id.toString()); } catch { return null; } })
      .filter(Boolean);

    const wallets = await DeliveryWallet.find({
      deliveryId: { $in: objectIds }
    }).select('deliveryId cashInHand').lean();

    const cashMap = {};
    wallets.forEach(w => { cashMap[w.deliveryId.toString()] = Number(w.cashInHand) || 0; });

    const filtered = deliveryPartnerIds.filter(id => {
      const cashInHand = cashMap[id.toString()] || 0;
      return cashInHand + orderTotal <= cashLimit;
    });

    if (filtered.length < deliveryPartnerIds.length) {
      console.log(`💰 COD cash limit filter: ${deliveryPartnerIds.length} → ${filtered.length} partners (order total: ₹${orderTotal}, limit: ₹${cashLimit})`);
    }

    return filtered;
  } catch (err) {
    console.warn('⚠️ COD cash limit filter failed, returning all partners:', err.message);
    return deliveryPartnerIds;
  }
}
