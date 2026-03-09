import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Notification from '../models/Notification.js';
import DeviceToken from '../models/DeviceToken.js';
import { sendPushNotification } from '../utils/pushNotificationHelper.js';

/**
 * Broadcast notification to specific roles or all users.
 *
 * Body:
 *  {
 *    title: string;
 *    body: string;
 *    imageUrl?: string;
 *    targetRole?: 'all' | 'customer' | 'user' | 'restaurant' | 'delivery';
 *    data?: Record<string, string>;
 *  }
 */
export const broadcastNotification = asyncHandler(async (req, res) => {
  const {
    title,
    body,
    imageUrl,
    targetRole = 'all',
    data = {}
  } = req.body;

  if (!title || !body) {
    return errorResponse(res, 400, 'Title and Body are required');
  }

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
    imageUrl,
    target: notificationTarget,
    sourceType: 'admin_direct'
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

  console.log(`[Broadcast] targetRole=${targetRole}, deviceRoleFilter=${deviceRoleFilter}, query=${JSON.stringify(query)}`);
  console.log(`[AdminBroadcast] Query: ${JSON.stringify(query)}`);
  const tokensRaw = await DeviceToken.find(query).select('deviceToken role').lean();
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
    await sendPushNotification(uniqueTokens, {
      title,
      body,
      imageUrl,
      data: {
        ...data,
        notificationId: notification._id.toString(),
        target: deviceRoleFilter || 'all'
      }
    });
  }

  return successResponse(res, 200, 'Broadcast initiated', {
    sentCount: tokens.length,
    notificationId: notification._id
  });
});
