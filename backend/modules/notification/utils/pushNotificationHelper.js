import admin from 'firebase-admin';
import DeviceToken from '../models/DeviceToken.js';
import User from '../../auth/models/User.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
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

async function removeInvalidTokensFromModels(tokens = []) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;

  const pullUpdate = {
    $pull: {
      fcmTokenWeb: { $in: tokens },
      fcmTokenMobile: { $in: tokens },
      fcmTokenApp: { $in: tokens },
      fcmTokens: { $in: tokens },
      deviceToken: { $in: tokens },
    },
  };

  try {
    const User = (await import('../../auth/models/User.js')).default;
    const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
    const Delivery = (await import('../../delivery/models/Delivery.js')).default;
    const { FoodDeliveryPartner } = await import('../../deliveryV2/models/deliveryPartner.model.js');
    const Admin = (await import('../../admin/models/Admin.js')).default;

    await Promise.allSettled([
      User.updateMany({}, pullUpdate),
      Restaurant.updateMany({}, pullUpdate),
      Delivery.updateMany({}, pullUpdate),
      FoodDeliveryPartner.updateMany({}, pullUpdate),
      Admin.updateMany({}, pullUpdate),
    ]);
  } catch (err) {
    console.warn('[FCM] Failed to purge invalid tokens from role models:', err?.message || err);
  }
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
          console.warn(`[FCM-DEBUG] Token Failed: ${tokens[idx]} | Error: ${errorCode} - ${resp.error?.message}`);
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
        console.warn(`[FCM-DEBUG] Firebase rejected ${invalidTokens.length} tokens. Invalid tokens: ${invalidTokens.join(', ')}`);
        await DeviceToken.deleteMany({
          deviceToken: {
            $in: invalidTokens
          }
        });
        await removeInvalidTokensFromModels(invalidTokens);
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
    const normalizedRole = role || 'user';
    console.log(`\n========================================`);
    console.log(`[FCM-STRICT-DEBUG] INCOMING NOTIFICATION`);
    console.log(`[FCM-STRICT-DEBUG] Recipient ID: ${userId} (Type: ${typeof userId})`);
    console.log(`[FCM-STRICT-DEBUG] Role: ${normalizedRole}`);
    console.log(`[FCM-STRICT-DEBUG] Title: ${title}`);
    console.log(`========================================\n`);

    if (!userId || userId === 'undefined' || userId === 'null') {
      console.warn(`[FCM-STRICT-DEBUG] ABORTING: Invalid userId passed: ${userId}`);
      return;
    }

    const defaultClickUrlByRole = {
      user: '/orders',
      restaurant: '/orders',
      delivery: '/delivery',
      admin: '/admin'
    };
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

    const sanitizedData = {};
    for (const [key, value] of Object.entries(enrichedData)) {
      if (value !== null && value !== undefined) {
        sanitizedData[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }

    const payload = {
      title: `[${normalizedRole}] ${resolvedTitle}`,
      body: resolvedBody,
      data: sanitizedData
    };
    let tokens = [];
    let modelDoc = null;

    if (role === 'user') {
      modelDoc = await User.findById(userId).select('fcmTokenWeb fcmTokenMobile').lean();
    } else if (role === 'delivery' || role === 'DELIVERY_PARTNER') {
      const { FoodDeliveryPartner } = await import('../../deliveryV2/models/deliveryPartner.model.js');
      const Delivery = (await import('../../delivery/models/Delivery.js')).default;

      // Try V2 first
      modelDoc = await FoodDeliveryPartner.findById(userId).select('fcmTokenWeb fcmTokenMobile').lean();

      // If not found in V2, fallback to V1
      if (!modelDoc) {
        modelDoc = await Delivery.findById(userId).select('fcmTokenWeb fcmTokenMobile').lean();
      }
    } else if (role === 'restaurant') {
      modelDoc = await Restaurant.findById(userId).select('fcmTokenWeb fcmTokenMobile').lean();
    } else if (role === 'admin') {
      // Assuming Admin model hasn't been updated to the array format, but try reading it
      const Admin = (await import('../../admin/models/Admin.js')).default;
      modelDoc = await Admin.findById(userId).select('fcmTokenWeb fcmTokenMobile fcmTokenApp fcmTokens').lean();
    }

    if (modelDoc) {
      const getTokens = (field) => {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        if (typeof field === 'string') return [field];
        return [];
      };

      tokens = [
        ...getTokens(modelDoc.fcmTokenWeb),
        ...getTokens(modelDoc.fcmTokenMobile),
        ...getTokens(modelDoc.fcmTokenApp),
        ...getTokens(modelDoc.fcmTokens),
        ...getTokens(modelDoc.deviceToken)
      ].filter(Boolean);
      console.log(`[FCM-DEBUG] Found tokens for ${role} ${userId}: ${tokens.length} tokens found in model.`);
    } else {
      console.log(`[FCM-DEBUG] No tokens found for ${role} ${userId} in model. Document exists: ${!!modelDoc}`);
    }

    if (tokens.length > 0) {
      // Deduplicate
      const uniqueTokens = Array.from(new Set(tokens));
      console.log(`[FCM-DEBUG] Sending push to ${uniqueTokens.length} unique tokens for ${role} ${userId}`);
      await sendPushNotification(uniqueTokens, payload);
    } else {
      console.warn(`[FCM-DEBUG] FAILED to send push: No tokens available for ${role} ${userId}`);
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
  if (normalizedRole === 'delivery' || normalizedRole === 'DELIVERY_PARTNER') {
    const { FoodDeliveryPartner } = await import('../../deliveryV2/models/deliveryPartner.model.js');
    const Delivery = (await import('../../delivery/models/Delivery.js')).default;

    let delivery = await FoodDeliveryPartner.findById(userId).select('preferences.language').lean();
    if (!delivery) {
      delivery = await Delivery.findById(userId).select('preferences.language').lean();
    }
    return normalizeLocale(delivery?.preferences?.language);
  }
  if (normalizedRole === 'admin') {
    const adminUser = await Admin.findById(userId).select('preferences.language').lean();
    return normalizeLocale(adminUser?.preferences?.language);
  }

  return 'en';
}

