import express from 'express';
import { authenticate as authenticateRestaurant } from '../restaurant/middleware/restaurantAuth.js';
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

router.delete('/tokens', removeDeviceToken);

// ── Restaurant routes (/api/notification/...) ─────────────────────────────
// Submit a new notification request (restaurant auth)
router.post('/requests', authenticateRestaurant, submitNotificationRequest);

// Get own submitted requests + quota info
router.get('/requests/my', authenticateRestaurant, getMyNotificationRequests);

// Delete own request
router.delete('/requests/:id', authenticateRestaurant, deleteMyNotificationRequest);

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
