import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Notification from '../models/Notification.js';
import DeviceToken from '../models/DeviceToken.js';
import { sendPushNotification } from '../utils/pushNotificationHelper.js';
import { uploadToCloudinary } from '../../../shared/utils/cloudinaryService.js';
import Zone from '../../admin/models/Zone.js';
import User from '../../auth/models/User.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Delivery from '../../delivery/models/Delivery.js';
import { buildLocalizedText } from '../../../shared/i18n/translationService.js';
import { resolveLocaleFromRequest } from '../../../shared/i18n/localeResolver.js';
import { resolveLocalizedText } from '../../../shared/i18n/localizedText.js';

/**
 * Broadcast notification to specific roles or all users.
 *
 * Body:
 *  {
 *    title: string;
 *    body: string;
 *    imageUrl?: string;
 *    targetRole?: 'all' | 'customer' | 'user' | 'restaurant' | 'delivery';
 *    targetZone?: 'all' | string;
 *    data?: Record<string, string>;
 *  }
 */
export const broadcastNotification = asyncHandler(async (req, res) => {
  const {
    title,
    body,
    targetRole = 'all',
    targetZone = 'all',
    data = {}
  } = req.body;

  // Handle image upload with Cloudinary fallback
  let imageUrl = req.body.imageUrl;
  if (req.file) {
    try {
      const result = await uploadToCloudinary(req.file.buffer, {
        folder: 'appzeto/notifications',
        resource_type: 'image'
      });
      imageUrl = result.secure_url;
    } catch (uploadError) {
      console.error('[Broadcast] Image upload failed:', uploadError);
      // Continue without image or handle error as needed
    }
  }

  if (!title || !body) {
    return errorResponse(res, 400, 'Title and Body are required');
  }

  const localizedTitle = await buildLocalizedText(title);
  const localizedDescription = await buildLocalizedText(body);

  // Map targetRole → Notification.target + DeviceToken.role filter
  let notificationTarget = 'all_users';
  let deviceRoleFilter = undefined;

  switch (targetRole) {
    case 'customer':
    case 'user':
      notificationTarget = 'all_users';
      deviceRoleFilter = 'user';
      break;
    case 'restaurant':
      notificationTarget = 'all_restaurants';
      deviceRoleFilter = 'restaurant';
      break;
    case 'delivery':
      notificationTarget = 'all_delivery';
      deviceRoleFilter = 'delivery';
      break;
    case 'all':
    default:
      notificationTarget = 'all_users';
      deviceRoleFilter = 'all'; // custom flag for query
      break;
  }

  // Persist notification record for history
  const notification = await Notification.create({
    title,
    description: body,
    localizedTitle,
    localizedDescription,
    imageUrl,
    target: notificationTarget,
    sourceType: 'admin_direct',
    targetZone: targetZone !== 'all' ? targetZone : null
  });

  // Fetch tokens from DeviceToken collection
  const query = {
    isActive: true
  };

  // Role filtering: Exclude 'admin' from push notifications by default
  // unless the admin specifically targets their own role (optional)
  if (deviceRoleFilter === 'all') {
    query.role = { $ne: 'admin' };
  } else if (deviceRoleFilter) {
    query.role = deviceRoleFilter;
  }

  // Zone filtering
  if (targetZone && targetZone !== 'all') {
    const zone = await Zone.findById(targetZone);
    if (!zone) {
      return errorResponse(res, 404, 'Target zone not found');
    }

    const matchedUserIds = [];

    // Filter Users by location within Zone boundary
    if (deviceRoleFilter === 'all' || deviceRoleFilter === 'user') {
      const usersInZone = await User.find({
        $or: [
          {
            'currentLocation.location': {
              $geoWithin: {
                $geometry: zone.boundary
              }
            }
          },
          {
            'addresses.location': {
              $geoWithin: {
                $geometry: zone.boundary
              }
            }
          }
        ]
      }).select('_id').lean();
      matchedUserIds.push(...usersInZone.map(u => u._id));
    }

    // Filter Restaurants by zoneId
    if (deviceRoleFilter === 'all' || deviceRoleFilter === 'restaurant') {
      const restaurantsInZone = await Restaurant.find({ zoneId: targetZone }).select('_id').lean();
      matchedUserIds.push(...restaurantsInZone.map(r => r._id));
    }

    // Filter Delivery Partners by zoneId (availability.zones)
    if (deviceRoleFilter === 'all' || deviceRoleFilter === 'delivery') {
      const deliveryInZone = await Delivery.find({ 'availability.zones': targetZone }).select('_id').lean();
      matchedUserIds.push(...deliveryInZone.map(d => d._id));
    }

    // Add filter logic
    if (matchedUserIds.length === 0) {
      // Short-circuit if no users found in this zone
      return successResponse(res, 200, 'No users found in this zone to broadcast to', {
        sentCount: 0,
        notificationId: notification._id
      });
    }

    query.userId = { $in: matchedUserIds };
  }

  console.log(`[Broadcast] targetRole=${targetRole}, targetZone=${targetZone}, deviceRoleFilter=${deviceRoleFilter}, query=${JSON.stringify(query)}`);
  console.log(`[AdminBroadcast] Query: ${JSON.stringify(query)}`);
  const tokensRaw = await DeviceToken.find(query).select('deviceToken role userId').lean();
  const tokens = tokensRaw.map(t => t.deviceToken).filter(Boolean);
  console.log(`[AdminBroadcast] Found ${tokens.length} tokens for role filter`);
  if (tokens.length > 0) {
    console.log(`[AdminBroadcast] First token sample: ${tokens[0].substring(0, 10)}...`);
  }

  if (tokens.length > 0) {
    const uniqueTokens = Array.from(new Set(tokens));
    const roleCounts = tokensRaw.reduce((acc, t) => {
      acc[t.role] = (acc[t.role] || 0) + 1;
      return acc;
    }, {});

    console.log(`[Broadcast] targetRole="${targetRole}" | Total Unique Tokens: ${uniqueTokens.length}`);
    console.log(`[Broadcast] Breakdown by Role: ${JSON.stringify(roleCounts)}`);

    // Background/foreground logic is handled inside pushNotificationHelper
    const localeGroups = await buildLocaleTokenGroups(tokensRaw);

    for (const [locale, groupedTokens] of localeGroups.entries()) {
      const deduped = Array.from(new Set(groupedTokens));
      await sendPushNotification(deduped, {
        title: resolveLocalizedText(notification.localizedTitle, locale, title),
        body: resolveLocalizedText(notification.localizedDescription, locale, body),
        imageUrl,
        data: {
          ...data,
          notificationId: notification._id.toString(),
          target: deviceRoleFilter || 'all',
          locale
        }
      });
    }
  }

  return successResponse(res, 200, 'Broadcast initiated', {
    sentCount: tokens.length,
    notificationId: notification._id
  });
});

/**
 * GET /api/admin/notifications/broadcast/history
 * Fetch all broadcast history for admin.
 */
export const getBroadcastHistory = asyncHandler(async (req, res) => {
  const locale = resolveLocaleFromRequest(req);
  const { page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total] = await Promise.all([
    Notification.find({})
      .populate('targetZone', 'name')
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Notification.countDocuments({})
  ]);

  return successResponse(res, 200, 'Notification history fetched', {
    notifications: notifications.map((notification) => ({
      ...notification,
      title: resolveLocalizedText(notification.localizedTitle, locale, notification.title),
      description: resolveLocalizedText(notification.localizedDescription, locale, notification.description)
    })),
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * DELETE /api/admin/notifications/broadcast/:id
 * Delete a specific notification record.
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const notification = await Notification.findByIdAndDelete(id);
  if (!notification) {
    return errorResponse(res, 404, 'Notification not found');
  }

  return successResponse(res, 200, 'Notification deleted successfully');
});

async function buildLocaleTokenGroups(tokensRaw) {
  const idsByRole = {
    user: [],
    restaurant: [],
    delivery: []
  };

  tokensRaw.forEach((row) => {
    if (idsByRole[row.role]) {
      idsByRole[row.role].push(String(row.userId));
    }
  });

  const [users, restaurants, deliveries] = await Promise.all([
    idsByRole.user.length
      ? User.find({ _id: { $in: idsByRole.user } }).select('_id preferences.language').lean()
      : [],
    idsByRole.restaurant.length
      ? Restaurant.find({ _id: { $in: idsByRole.restaurant } }).select('_id preferences.language').lean()
      : [],
    idsByRole.delivery.length
      ? Delivery.find({ _id: { $in: idsByRole.delivery } }).select('_id preferences.language').lean()
      : []
  ]);

  const localeById = new Map();
  [...users, ...restaurants, ...deliveries].forEach((row) => {
    localeById.set(String(row._id), row.preferences?.language || 'en');
  });

  const groups = new Map();
  tokensRaw.forEach((row) => {
    const locale = localeById.get(String(row.userId)) || 'en';
    const list = groups.get(locale) || [];
    list.push(row.deviceToken);
    groups.set(locale, list);
  });

  return groups;
}
