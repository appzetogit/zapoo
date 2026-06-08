import admin from 'firebase-admin';
import DeviceToken from '../models/DeviceToken.js';
import User from '../../auth/models/User.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Delivery from '../../delivery/models/Delivery.js';
import Admin from '../../admin/models/Admin.js';
import { renderNotificationTemplate } from '../../../shared/i18n/notificationTemplates.js';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';
import { resolveLocalizedText } from '../../../shared/i18n/localizedText.js';

function buildNotificationId(data = {}) {
  if (data?.notificationId && String(data.notificationId).trim()) {
    return String(data.notificationId).trim();
  }
  const role = String(data?.target || 'user');
  const entity = String(data?.orderId || data?.orderMongoId || data?.withdrawalRequestId || 'event');
  return `${role}_${entity}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function looksLikeMongoObjectId(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

/**
 * Resolve a Firebase Admin app instance that has messaging enabled.
 * Prefers the named "zapoo-rtdb" app used for RTDB/FCM; falls back to the
 * default app if available.
 */
function getFirebaseMessagingApp() { 
  // Prefer the explicitly configured RTDB app
  let app = admin.apps.find(a => a?.name === 'zapoo-rtdb');

  if (!app) {
    // Fallback to the first initialized app (e.g. from FirebaseAuthService)
    if (admin.apps.length > 0) {
      console.warn('[FCM] zapoo-rtdb app not found, falling back to default Firebase Admin app for messaging.');
      app = admin.apps[0];
    }
  }

  if (!app) {
    console.warn('[FCM] No Firebase Admin app initialized. Skipping push.');
    return null;
  }

  try {
    // This will throw if messaging is not available on this app
    // (older admin SDKs or misconfigured credentials)
    // We just access it to validate; the caller will use app.messaging().
    // eslint-disable-next-line no-unused-expressions
    app.messaging;
    return app;
  } catch (err) {
    console.error('[FCM] Firebase Admin messaging is not available on the current app:', err?.message);
    return null;
  }
}

/**
 * Sends a push notification to a batch of tokens.
 * @param {Array<string>} tokens - Array of FCM device tokens.
 * @param {Object} payload - Notification payload { title, body, imageUrl, data }.
 */
export async function sendPushNotification(tokens, payload) {
  if (!tokens || tokens.length === 0) {
    console.warn('[FCM] sendPushNotification called with no tokens. Skipping.');
    return;
  }

  const app = getFirebaseMessagingApp();
  if (!app) {
    return;
  }

  const {
    title,
    body,
    imageUrl,
    data = {}
  } = payload;
  const notificationId = buildNotificationId(data);
  const normalizedPriority = String(data.notificationPriority || 'high').toLowerCase();
  const isHighPriority = normalizedPriority !== 'normal';

  const message = {
    notification: {
      title,
      body,
      ...(imageUrl ? { image: imageUrl } : {})
    },
    data: {
      ...data,
      notificationId,
      title,
      body,
      clickUrl: data.clickUrl || '/',
      ...(imageUrl ? { imageUrl } : {})
    },
    // Ensure background notifications work on Android/iOS
    android: {
      priority: isHighPriority ? 'high' : 'normal',
      notification: {
        priority: isHighPriority ? 'max' : 'default',
        sound: 'default'
      }
    },
    apns: {
      headers: {
        'apns-priority': isHighPriority ? '10' : '5',
        'apns-push-type': 'alert'
      },
      payload: {
        aps: {
          contentAvailable: true,
          badge: 1,
          sound: 'default'
        }
      }
    }
  };

  try {
    console.log(`[FCM] Sending push to ${tokens.length} tokens with title="${title}"`);
    const response = await app.messaging().sendEachForMulticast({
      tokens,
      ...message
    });
    console.log(`[FCM] Multicast response: success=${response.successCount}, failure=${response.failureCount}`);

    // Handle invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code || '';
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered' ||
            errorCode.includes('invalid-registration-token') ||
            errorCode.includes('registration-token-not-registered')
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        console.warn(`[FCM] Cleaning up ${invalidTokens.length} invalid tokens from DeviceToken collection.`);
        await DeviceToken.deleteMany({
          deviceToken: {
            $in: invalidTokens
          }
        });
      }
    }
  } catch (error) {
    console.error('[FCM] Error sending multicast message:', error);
  }
}

/**
 * Sends a notification to a specific user by querying their stored tokens.
 * @param {string} userId - ID of the user.
 * @param {string} role - User role ('user', 'restaurant', 'delivery').
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {Object} data - Optional data payload for the notification.
 */
export async function sendNotificationToUser(userId, role, title, body, data = {}) {
  try {
    console.log(`[FCM-TRACE] sendNotificationToUser:start role=${role} userId=${userId} type=${data?.type || 'na'} template=${data?.templateKey || 'na'}`);
    const defaultClickUrlByRole = {
      user: '/orders',
      restaurant: '/orders',
      delivery: '/delivery',
      admin: '/admin'
    };
    const normalizedRole = role || 'user';
    const clickUrl = data.clickUrl || defaultClickUrlByRole[normalizedRole] || '/';
    const enrichedData = {
      target: normalizedRole,
      clickUrl,
      ...data
    };

    const recipientLocale = await resolveRecipientLocale(userId, role);
    let resolvedTitle = title;
    let resolvedBody = body;

    if (data?.templateKey) {
      try {
        const rendered = await renderNotificationTemplate(
          data.templateKey,
          data.templateVars || {},
          recipientLocale
        );
        resolvedTitle = rendered?.title || resolvedTitle;
        resolvedBody = rendered?.body || resolvedBody;
      } catch (templateError) {
        console.warn(
          `[FCM] Template render failed for key="${data.templateKey}", using raw title/body fallback:`,
          templateError?.message || templateError
        );
      }
    } else {
      resolvedTitle = resolveLocalizedText(title, recipientLocale, typeof title === 'string' ? title : '');
      resolvedBody = resolveLocalizedText(body, recipientLocale, typeof body === 'string' ? body : '');
    }

    const roleTitleMap = {
      user: 'USER',
      restaurant: 'RESTAURANT',
      delivery: 'DELIVERY PARTNER',
      admin: 'ADMIN'
    };
    const roleTitleLabel = roleTitleMap[normalizedRole] || String(normalizedRole || 'NOTIFICATION').toUpperCase();
    resolvedTitle = `[${roleTitleLabel}] ${resolvedTitle || 'Notification'}`;

    let resolvedUserId = userId;
    if (role === 'restaurant' && !looksLikeMongoObjectId(String(userId || ''))) {
      const restaurantDoc = await Restaurant.findOne({
        $or: [
          { restaurantId: String(userId || '') },
          { slug: String(userId || '') }
        ]
      }).select('_id').lean();
      if (restaurantDoc?._id) {
        resolvedUserId = restaurantDoc._id.toString();
        console.log(`[FCM-TRACE] restaurantId resolved: input=${userId} resolved=${resolvedUserId}`);
      }
    }

    const payload = {
      title: resolvedTitle,
      body: resolvedBody,
      data: enrichedData
    };
    const tokensRaw = await DeviceToken.find({
      userId: resolvedUserId,
      role,
      isActive: true
    }).select('deviceToken').lean();
    let tokens = tokensRaw.map(t => t.deviceToken).filter(Boolean);
    console.log(`[FCM-TRACE] tokenLookup role=${role} userId=${resolvedUserId} activeTokens=${tokens.length}`);

    // Fallback to role-model legacy fields when DeviceToken rows are missing.
    if (tokens.length === 0 && role === 'user') {
      const user = await User.findById(userId).select('fcmTokensWeb fcmTokensMobile').lean();
      if (user) {
        tokens = [
          ...(Array.isArray(user.fcmTokensWeb) ? user.fcmTokensWeb : []),
          ...(Array.isArray(user.fcmTokensMobile) ? user.fcmTokensMobile : [])
        ].filter(Boolean);
        console.log(`[FCM-TRACE] userLegacyFallback userId=${userId} fallbackTokens=${tokens.length}`);
      }
    } else if (tokens.length === 0 && role === 'delivery') {
      const delivery = await Delivery.findById(userId).select('fcmTokensWeb fcmTokensMobile').lean();
      if (delivery) {
        tokens = [
          ...(Array.isArray(delivery.fcmTokensWeb) ? delivery.fcmTokensWeb : []),
          ...(Array.isArray(delivery.fcmTokensMobile) ? delivery.fcmTokensMobile : [])
        ].filter(Boolean);
        console.log(`[FCM-TRACE] deliveryLegacyFallback userId=${userId} fallbackTokens=${tokens.length}`);
      }
    } else if (tokens.length === 0 && role === 'restaurant') {
      const restaurant = await Restaurant.findById(userId).select('fcmTokensWeb fcmTokensMobile').lean();
      if (restaurant) {
        tokens = [
          ...(Array.isArray(restaurant.fcmTokensWeb) ? restaurant.fcmTokensWeb : []),
          ...(Array.isArray(restaurant.fcmTokensMobile) ? restaurant.fcmTokensMobile : [])
        ].filter(Boolean);
        console.log(`[FCM-TRACE] restaurantLegacyFallback userId=${userId} fallbackTokens=${tokens.length}`);
      }
    }
    if (tokens.length > 0) {
      // Deduplicate
      const uniqueTokens = Array.from(new Set(tokens));
      console.log(`[FCM-TRACE] send role=${role} userId=${userId} uniqueTokens=${uniqueTokens.length} clickUrl=${enrichedData.clickUrl || '/'}`);
      await sendPushNotification(uniqueTokens, payload);
    } else {
      console.warn(`[FCM-TRACE] noTokens role=${role} userId=${resolvedUserId}`);
    }
  } catch (error) {
    console.error(`[FCM] Error in sendNotificationToUser for ${userId}:`, error);
  }
}

async function resolveRecipientLocale(userId, role) {
  const normalizedRole = role || 'user';

  if (normalizedRole === 'user') {
    const user = await User.findById(userId).select('preferences.language').lean();
    return normalizeLocale(user?.preferences?.language);
  }
  if (normalizedRole === 'restaurant') {
    const restaurant = await Restaurant.findById(userId).select('preferences.language').lean();
    return normalizeLocale(restaurant?.preferences?.language);
  }
  if (normalizedRole === 'delivery') {
    const delivery = await Delivery.findById(userId).select('preferences.language').lean();
    return normalizeLocale(delivery?.preferences?.language);
  }
  if (normalizedRole === 'admin') {
    const adminUser = await Admin.findById(userId).select('preferences.language').lean();
    return normalizeLocale(adminUser?.preferences?.language);
  }

  return 'en';
}

