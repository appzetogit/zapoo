import express from 'express';
import { authenticate as authenticateRestaurant } from '../restaurant/middleware/restaurantAuth.js';
import { checkFeatureAccess } from '../restaurant/middleware/subscriptionGuard.js';
import { authenticate } from '../auth/middleware/auth.js';
import { authenticateAdmin } from '../admin/middleware/adminAuth.js';
import { authenticate as authenticateDelivery } from '../delivery/middleware/deliveryAuth.js';
import {
  submitNotificationRequest,
  getMyNotificationRequests,
  deleteMyNotificationRequest,
  adminGetAllRequests,
  adminApproveRequest,
  adminRejectRequest,
  getNotificationSettings,
  updateNotificationSettings,
  getUserNotifications
} from './controllers/notificationRequestController.js';
import {
  saveDeviceToken,
  removeDeviceToken
} from './controllers/fcmTokenController.js';
import { sendNotificationToUser } from './utils/pushNotificationHelper.js';

const router = express.Router();

// ── Device token routes (/api/notification/...) ────────────────────────────
// Generic FCM device token registration per role
router.post('/tokens/user', authenticate, (req, res, next) => {
  req.body.role = 'user';
  return saveDeviceToken(req, res, next);
});

router.post('/tokens/restaurant', authenticateRestaurant, (req, res, next) => {
  req.body.role = 'restaurant';
  return saveDeviceToken(req, res, next);
});

router.post('/tokens/delivery', authenticateDelivery, (req, res, next) => {
  // For delivery partner apps using delivery auth, extend here when needed.
  req.body.role = 'delivery';
  return saveDeviceToken(req, res, next);
});

router.post('/tokens/admin', authenticateAdmin, (req, res, next) => {
  req.body.role = 'admin';
  return saveDeviceToken(req, res, next);
});

// Test push routes
router.post('/test/user', authenticate, async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User not resolved'
      });
    }

    const now = new Date().toISOString();
    await sendNotificationToUser(
      String(userId),
      'user',
      'FCM Test Notification',
      `Push is working for your user account at ${now}`,
      {
        clickUrl: '/user/notifications',
        type: 'fcm_test',
        notificationId: `user_test_${userId}_${Date.now()}`
      }
    );

    return res.status(200).json({
      success: true,
      message: 'User test push triggered'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to trigger user test push'
    });
  }
});

router.post('/test/restaurant', authenticateRestaurant, async (req, res) => {
  try {
    const restaurantId = req.restaurant?._id || req.user?._id;
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant user not resolved'
      });
    }

    const now = new Date().toISOString();
    await sendNotificationToUser(
      String(restaurantId),
      'restaurant',
      'FCM Test Notification',
      `Push is working for your restaurant account at ${now}`,
      {
        clickUrl: '/restaurant/notifications',
        type: 'fcm_test',
        notificationId: `restaurant_test_${restaurantId}_${Date.now()}`
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Restaurant test push triggered'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to trigger restaurant test push'
    });
  }
});

router.post('/test/delivery', authenticateDelivery, async (req, res) => {
  try {
    const deliveryId = req.delivery?._id;
    if (!deliveryId) {
      return res.status(400).json({
        success: false,
        message: 'Delivery user not resolved'
      });
    }

    const now = new Date().toISOString();
    await sendNotificationToUser(
      String(deliveryId),
      'delivery',
      'FCM Test Notification',
      `Push is working for your account at ${now}`,
      {
        clickUrl: '/food/delivery/notifications',
        type: 'fcm_test',
        notificationId: `delivery_test_${deliveryId}_${Date.now()}`
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Test push triggered'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to trigger test push'
    });
  }
});

router.delete('/tokens', removeDeviceToken);

// ── Restaurant routes (/api/notification/...) ─────────────────────────────
// Submit a new notification request (restaurant auth)
router.post('/requests', authenticateRestaurant, checkFeatureAccess('marketing_tools'), submitNotificationRequest);

// Get own submitted requests + quota info
router.get('/requests/my', authenticateRestaurant, checkFeatureAccess('marketing_tools'), getMyNotificationRequests);

// Delete own request
router.delete('/requests/:id', authenticateRestaurant, checkFeatureAccess('marketing_tools'), deleteMyNotificationRequest);

// ── User route (/api/notification/...) ────────────────────────────────────
// Get all active notifications (history/list view)
router.get('/users', authenticate, getUserNotifications);

// ── Admin routes (/api/notification/admin/...) ───────────────────────────
router.get('/admin/requests', authenticateAdmin, adminGetAllRequests);
router.patch('/admin/requests/:id/approve', authenticateAdmin, adminApproveRequest);
router.patch('/admin/requests/:id/reject', authenticateAdmin, adminRejectRequest);
router.get('/admin/settings', authenticateAdmin, getNotificationSettings);
router.patch('/admin/settings', authenticateAdmin, updateNotificationSettings);

export default router;
