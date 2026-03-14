import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import NotificationRequest from '../models/NotificationRequest.js';
import Notification from '../models/Notification.js';
import BusinessSettings from '../../admin/models/BusinessSettings.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import User from '../../auth/models/User.js';
import admin from 'firebase-admin';
import { calculateDistance } from '../../order/services/orderCalculationService.js';

/**
 * POST /api/notification-requests
 * Restaurant submits a push notification request to admin.
 * Enforces the admin-configured daily limit per restaurant.
 */
export const submitNotificationRequest = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const {
    title,
    description,
    imageUrl
  } = req.body;
  if (!title || !description) {
    return errorResponse(res, 400, 'Title and description are required');
  }
  const settings = await BusinessSettings.getSettings();
  const dailyLimit = settings.restaurantNotificationDailyLimit ?? 2;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const todayCount = await NotificationRequest.countDocuments({
    restaurantId,
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });
  if (todayCount >= dailyLimit) {
    return errorResponse(res, 429, `Daily limit reached (${dailyLimit} requests/day). Resets at midnight.`, {
      todayCount,
      dailyLimit
    });
  }
  const existingPending = await NotificationRequest.findOne({
    restaurantId,
    status: 'pending'
  });
  if (existingPending) {
    return errorResponse(res, 400, 'You already have a pending request. Wait for admin review before submitting another.');
  }
  const request = await NotificationRequest.create({
    restaurantId,
    title: title.trim(),
    description: description.trim(),
    imageUrl: imageUrl || null
  });
  const remaining = dailyLimit - (todayCount + 1);
  return successResponse(res, 201, 'Notification request submitted successfully', {
    request,
    quota: {
      used: todayCount + 1,
      limit: dailyLimit,
      remaining
    }
  });
});

/**
 * GET /api/notification-requests
 * Restaurant fetches its own requests (all time).
 */
export const getMyNotificationRequests = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const settings = await BusinessSettings.getSettings();
  const dailyLimit = settings.restaurantNotificationDailyLimit ?? 2;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const [requests, todayCount] = await Promise.all([NotificationRequest.find({
    restaurantId
  }).sort({
    createdAt: -1
  }).lean(), NotificationRequest.countDocuments({
    restaurantId,
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  })]);
  return successResponse(res, 200, 'Notification requests fetched', {
    requests,
    quota: {
      used: todayCount,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - todayCount)
    }
  });
});

/**
 * DELETE /api/notification/requests/:id
 * Restaurant deletes one of its own requests (soft delete).
 */
export const deleteMyNotificationRequest = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurant._id;
  const { id } = req.params;

  const existing = await NotificationRequest.findOne({ _id: id, restaurantId });
  if (!existing) {
    return errorResponse(res, 404, 'Notification request not found');
  }

  await NotificationRequest.deleteOne({ _id: id });

  return successResponse(res, 200, 'Notification request deleted successfully', {});
});

/**
 * GET /api/admin/notification-requests
 * Admin fetches all requests with optional status filter.
 * Query: ?status=pending|approved|rejected
 */
export const adminGetAllRequests = asyncHandler(async (req, res) => {
  const {
    status,
    page = 1,
    limit = 20
  } = req.query;
  const query = {};
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    query.status = status;
  }
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [requests, total] = await Promise.all([NotificationRequest.find(query).populate('restaurantId', 'name restaurantId email phone').sort({
    createdAt: -1
  }).skip(skip).limit(parseInt(limit)).lean(), NotificationRequest.countDocuments(query)]);
  return successResponse(res, 200, 'Requests fetched', {
    requests,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * PATCH /api/admin/notification-requests/:id/approve
 * Admin approves a request (optionally editing title/description).
 * Creates a Notification in MongoDB and sends only to users in restaurant range.
 */
export const adminApproveRequest = asyncHandler(async (req, res) => {
  const {
    id
  } = req.params;
  const adminId = req.user._id;
  const titleOverride = req.body.title;
  const descriptionOverride = req.body.description;
  const request = await NotificationRequest.findById(id);
  if (!request) return errorResponse(res, 404, 'Notification request not found');
  if (request.status !== 'pending') {
    return errorResponse(res, 400, `Request already processed (status: ${request.status})`);
  }
  const restaurant = await Restaurant.findById(request.restaurantId).select('name location deliveryRange').lean();
  const restaurantCoords = restaurant?.location?.coordinates;
  const hasValidRestaurantCoords = Array.isArray(restaurantCoords) && restaurantCoords.length >= 2 && Number.isFinite(restaurantCoords[0]) && Number.isFinite(restaurantCoords[1]) && !(restaurantCoords[0] === 0 && restaurantCoords[1] === 0);
  const targetRangeKm = Number(restaurant?.deliveryRange) > 0 ? Number(restaurant.deliveryRange) : 5;
  const notification = await Notification.create({
    title: (titleOverride || request.title).trim(),
    description: (descriptionOverride || request.description).trim(),
    imageUrl: request.imageUrl,
    target: 'all_users',
    sourceType: 'restaurant_request',
    restaurantId: request.restaurantId,
    restaurantLocation: hasValidRestaurantCoords
      ? { type: 'Point', coordinates: restaurantCoords }
      : undefined,
    deliveryRangeKm: targetRangeKm
  });
  const userFilter = {
    role: 'user',
    isActive: true,
    $or: [{
      fcmTokens: {
        $exists: true,
        $not: {
          $size: 0
        }
      }
    }, {
      fcmTokenWeb: {
        $exists: true,
        $nin: [null, '']
      }
    }, {
      fcmTokenMobile: {
        $exists: true,
        $nin: [null, '']
      }
    }]
  };
  if (hasValidRestaurantCoords) {
    userFilter['currentLocation.location'] = {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: restaurantCoords
        },
        $maxDistance: Math.round(targetRangeKm * 1000)
      }
    };
  } else {
    console.warn(`[Notification] Restaurant ${request.restaurantId} has invalid coordinates. Sending without range filter.`);
  }
  const usersWithTokens = await User.find(userFilter, {
    _id: 1,
    fcmTokens: 1,
    fcmTokenWeb: 1,
    fcmTokenMobile: 1
  }).lean();
  const recipientUserIds = usersWithTokens.map(u => u._id?.toString()).filter(Boolean);
  const tokenSet = new Set();
  for (const user of usersWithTokens) {
    const rawTokens = [...(Array.isArray(user.fcmTokens) ? user.fcmTokens : []), user.fcmTokenWeb, user.fcmTokenMobile];
    for (const rawToken of rawTokens) {
      if (!rawToken || typeof rawToken !== 'string') continue;
      const token = rawToken.trim();
      if (token) tokenSet.add(token);
    }
  }
  const allTokens = Array.from(tokenSet);
  request.status = 'approved';
  request.reviewedAt = new Date();
  request.reviewedBy = adminId;
  request.sentNotificationId = notification._id;
  await request.save();
  try {
    if (allTokens.length > 0) {
      const rtdbApp = admin.apps.find(a => a?.name === 'zapoo-rtdb');
      if (!rtdbApp) {
        console.warn('[FCM] Firebase app zapoo-rtdb is not initialized. Skipping push.');
      } else {
        const BATCH_SIZE = 500;
        const invalidTokens = new Set();
        for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
          const batch = allTokens.slice(i, i + BATCH_SIZE);
          const fcmMessage = {
            tokens: batch,
            notification: {
              title: notification.title,
              body: notification.description,
              ...(notification.imageUrl ? {
                image: notification.imageUrl
              } : {})
            },
            data: {
              notificationId: notification._id.toString(),
              target: 'user',
              clickUrl: '/',
              ...(notification.imageUrl ? {
                imageUrl: notification.imageUrl
              } : {})
            }
          };
          const response = await rtdbApp.messaging().sendEachForMulticast(fcmMessage);
          response.responses.forEach((result, index) => {
            if (result.success || !result.error) return;
            const code = result.error.code || '';
            if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
              invalidTokens.add(batch[index]);
            }
          });
        }
        if (invalidTokens.size > 0) {
          const staleTokens = Array.from(invalidTokens);
          await Promise.all([User.updateMany({
            fcmTokens: {
              $in: staleTokens
            }
          }, {
            $pull: {
              fcmTokens: {
                $in: staleTokens
              }
            }
          }), User.updateMany({
            fcmTokenWeb: {
              $in: staleTokens
            }
          }, {
            $unset: {
              fcmTokenWeb: ''
            }
          }), User.updateMany({
            fcmTokenMobile: {
              $in: staleTokens
            }
          }, {
            $unset: {
              fcmTokenMobile: ''
            }
          })]);
        }
      }
    } else {}
  } catch (fcmErr) {
    console.error('FCM push failed:', fcmErr.message);
  }
  return successResponse(res, 200, 'Request approved and notification sent', {
    request,
    notification,
    audience: {
      usersInRange: recipientUserIds.length,
      tokensTargeted: allTokens.length,
      rangeKm: hasValidRestaurantCoords ? targetRangeKm : null,
      usedRangeFilter: hasValidRestaurantCoords
    }
  });
});

/**
 * PATCH /api/admin/notification-requests/:id/reject
 * Admin silently rejects a request. No reason given to restaurant.
 */
export const adminRejectRequest = asyncHandler(async (req, res) => {
  const {
    id
  } = req.params;
  const adminId = req.user._id;
  const request = await NotificationRequest.findById(id);
  if (!request) return errorResponse(res, 404, 'Notification request not found');
  if (request.status !== 'pending') {
    return errorResponse(res, 400, `Request already processed (status: ${request.status})`);
  }
  request.status = 'rejected';
  request.reviewedAt = new Date();
  request.reviewedBy = adminId;
  await request.save();
  return successResponse(res, 200, 'Request rejected', {
    request
  });
});

/**
 * GET /api/admin/notification-settings
 */
export const getNotificationSettings = asyncHandler(async (req, res) => {
  const settings = await BusinessSettings.getSettings();
  return successResponse(res, 200, 'Settings fetched', {
    restaurantNotificationDailyLimit: settings.restaurantNotificationDailyLimit ?? 2
  });
});

/**
 * PATCH /api/admin/notification-settings
 * Body: { restaurantNotificationDailyLimit: number }
 */
export const updateNotificationSettings = asyncHandler(async (req, res) => {
  const {
    restaurantNotificationDailyLimit
  } = req.body;
  if (restaurantNotificationDailyLimit === undefined || typeof restaurantNotificationDailyLimit !== 'number' || restaurantNotificationDailyLimit < 0) {
    return errorResponse(res, 400, 'restaurantNotificationDailyLimit must be a non-negative number');
  }
  const settings = await BusinessSettings.getSettings();
  settings.restaurantNotificationDailyLimit = restaurantNotificationDailyLimit;
  settings.updatedBy = req.user._id;
  await settings.save();
  return successResponse(res, 200, 'Settings updated', {
    restaurantNotificationDailyLimit: settings.restaurantNotificationDailyLimit
  });
});

/**
 * GET /api/notifications/users?latitude=&longitude=
 * Users fetch active notifications. Restaurant-originated notifications are
 * filtered by the restaurant's deliveryRange so users only see relevant ones.
 */
export const getUserNotifications = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.query;
  const userLat = latitude != null ? parseFloat(latitude) : null;
  const userLng = longitude != null ? parseFloat(longitude) : null;

  let notifications = await Notification.find({
    target: 'all_users',
    isActive: true
  }).sort({ sentAt: -1 }).limit(50).lean();

  if (userLat != null && userLng != null && Number.isFinite(userLat) && Number.isFinite(userLng)) {
    notifications = notifications.filter(n => {
      if (n.sourceType !== 'restaurant_request') return true;
      if (!n.restaurantLocation?.coordinates || n.restaurantLocation.coordinates.length < 2) return true;
      const dist = calculateDistance(n.restaurantLocation.coordinates, [userLng, userLat]);
      return dist <= (n.deliveryRangeKm || 5);
    });
  }

  return successResponse(res, 200, 'Notifications fetched', { notifications });
});