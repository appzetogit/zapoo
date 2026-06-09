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
  saveWebToken,
  saveMobileToken,
  removeDeviceToken
} from './controllers/fcmTokenController.js';
import { sendNotificationToUser } from './utils/pushNotificationHelper.js';
import jwtService from '../auth/services/jwtService.js';

const router = express.Router();

const universalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwtService.verifyAccessToken(token);
    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ── Device token routes (/api/notification/...) ────────────────────────────
// Generic FCM device token registration
router.post('/save-web-token', universalAuth, saveWebToken);
router.post('/save-mobile-token', universalAuth, saveMobileToken);

// Deprecated routes kept for backward compatibility (temporarily)
router.post('/tokens/user', authenticate, (req, res, next) => {
  req.user = { userId: req.user._id, role: 'user' };
  req.body.token = req.body.token; // Ensure token is present
  return req.body.platform === 'web' ? saveWebToken(req, res, next) : saveMobileToken(req, res, next);
});

router.post('/tokens/restaurant', authenticateRestaurant, (req, res, next) => {
  req.user = { userId: req.restaurant._id, role: 'restaurant' };
  return req.body.platform === 'web' ? saveWebToken(req, res, next) : saveMobileToken(req, res, next);
});

router.post('/tokens/delivery', authenticateDelivery, (req, res, next) => {
  req.user = { userId: req.delivery._id, role: 'delivery' };
  return req.body.platform === 'web' ? saveWebToken(req, res, next) : saveMobileToken(req, res, next);
});

router.post('/tokens/admin', authenticateAdmin, (req, res, next) => {
  req.user = { userId: req.admin._id, role: 'admin' };
  return req.body.platform === 'web' ? saveWebToken(req, res, next) : saveMobileToken(req, res, next);
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
