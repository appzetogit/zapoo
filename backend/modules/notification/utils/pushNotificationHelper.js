import admin from 'firebase-admin';
import DeviceToken from '../models/DeviceToken.js';
import User from '../../auth/models/User.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import Delivery from '../../delivery/models/Delivery.js';
import Admin from '../../admin/models/Admin.js';
import { renderNotificationTemplate } from '../../../shared/i18n/notificationTemplates.js';
import { normalizeLocale } from '../../../shared/i18n/localeConstants.js';
import { resolveLocalizedText } from '../../../shared/i18n/localizedText.js';

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

  const message = {
    notification: {
      title,
      body,
      ...(imageUrl ? { image: imageUrl } : {})
    },
    data: {
      ...data,
      title,
      body,
      clickUrl: data.clickUrl || '/',
      ...(imageUrl ? { imageUrl } : {})
    },
    // Ensure background notifications work on Android/iOS
    android: {
      priority: 'high',
      notification: {
        sound: 'default'
      }
    },
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
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
      const rendered = await renderNotificationTemplate(
        data.templateKey,
        data.templateVars || {},
        recipientLocale
      );
      resolvedTitle = rendered.title;
      resolvedBody = rendered.body;
    } else {
      resolvedTitle = resolveLocalizedText(title, recipientLocale, typeof title === 'string' ? title : '');
      resolvedBody = resolveLocalizedText(body, recipientLocale, typeof body === 'string' ? body : '');
    }

    const payload = {
      title: resolvedTitle,
      body: resolvedBody,
      data: enrichedData
    };
    const tokensRaw = await DeviceToken.find({
      userId,
      role,
      isActive: true
    }).select('deviceToken').lean();
    let tokens = tokensRaw.map(t => t.deviceToken).filter(Boolean);

    // Fallback to User model legacy fields if no tokens in DeviceToken and role is 'user'
    if (tokens.length === 0 && role === 'user') {
      const user = await User.findById(userId).select('fcmTokenWeb fcmTokenMobile fcmTokens').lean();
      if (user) {
        tokens = [user.fcmTokenWeb, user.fcmTokenMobile, ...(Array.isArray(user.fcmTokens) ? user.fcmTokens : [])].filter(Boolean);
      }
    }
    if (tokens.length > 0) {
      // Deduplicate
      const uniqueTokens = Array.from(new Set(tokens));
      await sendPushNotification(uniqueTokens, payload);
    } else {}
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
