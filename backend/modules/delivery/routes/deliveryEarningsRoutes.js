import express from 'express';
import { getEarnings } from '../controllers/deliveryEarningsController.js';
import { authenticate } from '../middleware/deliveryAuth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Earnings routes
router.get('/earnings', getEarnings);

export default router;

