import express from 'express';
import {
  getEarnings,
  getCashLimit,
  getPocketDetails,
  getReferralStats
} from '../controllers/deliveryEarningsController.js';
import { authenticate } from '../middleware/deliveryAuth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Earnings routes
router.get('/earnings', getEarnings);
router.get('/cash-limit', getCashLimit);
router.get('/pocket-details', getPocketDetails);
router.get('/referrals/stats', getReferralStats);

export default router;
