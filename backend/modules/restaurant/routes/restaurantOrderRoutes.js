import express from 'express';
import {
  getRestaurantOrders,
  getRestaurantOrderById,
  acceptOrder,
  rejectOrder,
  markOrderPreparing,
  markOrderReady
} from '../controllers/restaurantOrderController.js';
import { resendDeliveryNotification } from '../controllers/resendDeliveryNotification.js';
import {
  getRestaurantReviews,
  getReviewByOrderId
} from '../controllers/reviewController.js';
import { authenticate } from '../middleware/restaurantAuth.js';
import { checkFeatureAccess } from '../middleware/subscriptionGuard.js';

const router = express.Router();

// Order routes - each route requires restaurant authentication and order_management feature
router.get('/orders', authenticate, checkFeatureAccess('order_management'), getRestaurantOrders);
router.get('/orders/:id', authenticate, checkFeatureAccess('order_management'), getRestaurantOrderById);
router.patch('/orders/:id/accept', authenticate, checkFeatureAccess('order_management'), acceptOrder);
router.patch('/orders/:id/reject', authenticate, checkFeatureAccess('order_management'), rejectOrder);
router.patch('/orders/:id/preparing', authenticate, checkFeatureAccess('order_management'), markOrderPreparing);
router.patch('/orders/:id/ready', authenticate, checkFeatureAccess('order_management'), markOrderReady);
router.post('/orders/:id/resend-delivery-notification', authenticate, checkFeatureAccess('order_management'), resendDeliveryNotification);

// Review routes
router.get('/reviews', authenticate, getRestaurantReviews);
router.get('/reviews/:orderId', authenticate, getReviewByOrderId);

// Complaint routes - will be imported and used in restaurant index
export default router;

