import express from 'express';
import { authenticate as authenticateRestaurant } from '../restaurant/middleware/restaurantAuth.js';
import { authenticate } from '../auth/middleware/auth.js';
import { authenticateAdmin } from '../admin/middleware/adminAuth.js';
import {
  submitNotificationRequest,
  getMyNotificationRequests,
  adminGetAllRequests,
  adminApproveRequest,
  adminRejectRequest,
  getNotificationSettings,
  updateNotificationSettings,
  getUserNotifications,
} from './controllers/notificationRequestController.js';

const router = express.Router();

// ── Restaurant routes (/api/notification/...) ─────────────────────────────
// Submit a new notification request (restaurant auth)
router.post('/requests', authenticateRestaurant, submitNotificationRequest);

// Get own submitted requests + quota info
router.get('/requests/my', authenticateRestaurant, getMyNotificationRequests);

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
