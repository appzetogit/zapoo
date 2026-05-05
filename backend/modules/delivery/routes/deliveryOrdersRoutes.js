import express from 'express';
import { 
  getOrders, 
  getOrderDetails, 
  acceptOrder, 
  rejectOrder,
  confirmReachedPickup, 
  confirmOrderId,
  confirmReachedDrop,
  verifyDropOtp,
  completeDelivery,
  createCollectQr,
  getPaymentStatus,
  switchToCash
} from '../controllers/deliveryOrdersController.js';
import { getTripHistory } from '../controllers/deliveryTripHistoryController.js';
import { authenticate } from '../middleware/deliveryAuth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Orders routes
router.get('/orders', getOrders);
router.get('/orders/:orderId', getOrderDetails);
router.patch('/orders/:orderId/accept', acceptOrder);
router.patch('/orders/:orderId/reject', rejectOrder);
router.patch('/orders/:orderId/reached-pickup', confirmReachedPickup);
router.patch('/orders/:orderId/confirm-order-id', confirmOrderId);
router.patch('/orders/:orderId/reached-drop', confirmReachedDrop);
router.post('/orders/:orderId/verify-drop-otp', verifyDropOtp);
router.patch('/orders/:orderId/complete-delivery', completeDelivery);
router.post('/orders/:orderId/collect/qr', createCollectQr);
router.get('/orders/:orderId/payment-status', getPaymentStatus);
router.post('/orders/:orderId/collect/cash', switchToCash);

// Trip History route
router.get('/trip-history', getTripHistory);

export default router;
