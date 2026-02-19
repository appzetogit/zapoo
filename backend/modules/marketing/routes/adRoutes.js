import express from 'express';
import {
    createAdRequest,
    updateAdRequest,
    updateAdStatus,
    getActiveAdsByZone,
    trackAdMetric,
    getMyZone,
    getAllAdRequests,
    getMyAdRequests,
    getAdRequestById
} from '../controllers/adController.js';
import { uploadMiddleware } from '../../../shared/utils/cloudinaryService.js';
import { authenticate as restaurantAuth } from '../../restaurant/middleware/restaurantAuth.js';
import { authenticateAdmin } from '../../admin/middleware/adminAuth.js';

const router = express.Router();

// Restaurant routes
router.post('/request', restaurantAuth, uploadMiddleware.single('bannerImage'), createAdRequest);
router.put('/request/:adId', restaurantAuth, uploadMiddleware.single('bannerImage'), updateAdRequest);
router.get('/my-zone', restaurantAuth, getMyZone);
router.get('/my-ads', restaurantAuth, getMyAdRequests);

// Shared Admin/Restaurant Detail route
router.get('/:adId', restaurantAuth, getAdRequestById);

// Admin routes
router.put('/:adId/status', authenticateAdmin, updateAdStatus);
router.get('/all', authenticateAdmin, getAllAdRequests);

// Public/Common routes
router.get('/active/:zoneId', getActiveAdsByZone);
router.post('/:adId/track', trackAdMetric);

export default router;
