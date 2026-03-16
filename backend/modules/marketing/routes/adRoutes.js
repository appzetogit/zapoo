import express from 'express';
import {
    createAdRequest,
    updateAdRequest,
    updateAdStatus,
    getActiveAdsByZone,
    getNearbyAds,
    trackAdMetric,
    getMyZone,
    getAllAdRequests,
    getMyAdRequests,
    getAdRequestById,
    createAdPaymentOrder,
    verifyAdPayment,
    uploadAdminBanner,
    deleteAdRequest
} from '../controllers/adController.js';
import { uploadMiddleware } from '../../../shared/utils/cloudinaryService.js';
import { authenticate as restaurantAuth } from '../../restaurant/middleware/restaurantAuth.js';
import { checkFeatureAccess } from '../../restaurant/middleware/subscriptionGuard.js';
import { authenticateAdmin } from '../../admin/middleware/adminAuth.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Middleware to allow either Admin or Restaurant access
const authenticateAny = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        const token = authHeader.substring(7);
        // Decode token to get role without verification here
        // Verification happens in the specific middleware designated below
        const decoded = jwt.decode(token);

        if (!decoded || !decoded.role) {
            return res.status(401).json({ success: false, message: 'Invalid token structure' });
        }

        if (decoded.role === 'admin') {
            return authenticateAdmin(req, res, next);
        } else if (decoded.role === 'restaurant') {
            return restaurantAuth(req, res, next);
        } else {
            return res.status(403).json({ success: false, message: 'Unauthorized role' });
        }
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Restaurant routes
router.post('/request', restaurantAuth, checkFeatureAccess('marketing_tools'), createAdRequest);
router.put('/request/:adId', restaurantAuth, checkFeatureAccess('marketing_tools'), uploadMiddleware.single('bannerImage'), updateAdRequest);
router.get('/my-zone', restaurantAuth, checkFeatureAccess('marketing_tools'), getMyZone);
router.get('/my-ads', restaurantAuth, checkFeatureAccess('marketing_tools'), getMyAdRequests);
router.post('/payment/create-order/:adId', restaurantAuth, checkFeatureAccess('marketing_tools'), createAdPaymentOrder);
router.post('/payment/verify', restaurantAuth, checkFeatureAccess('marketing_tools'), verifyAdPayment);

// Admin routes
router.get('/all', authenticateAdmin, getAllAdRequests);
router.put('/:adId/status', authenticateAdmin, updateAdStatus);
router.post('/:adId/banner', authenticateAdmin, uploadMiddleware.single('bannerImage'), uploadAdminBanner);
router.delete('/:adId', authenticateAdmin, deleteAdRequest);

// Public/Common routes (must be above the /:adId catch-all)
router.get('/nearby', getNearbyAds);
router.get('/active/:zoneId', getActiveAdsByZone);
router.post('/:adId/track', trackAdMetric);

// Shared Admin/Restaurant Detail route (catch-all param — keep last among GETs)
router.get('/:adId', authenticateAny, getAdRequestById);

export default router;
