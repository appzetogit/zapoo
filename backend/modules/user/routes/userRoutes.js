import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
  updateUserLocation,
  getUserLocation,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress
} from '../controllers/userController.js';
import { authenticate } from '../../auth/middleware/auth.js';
import { uploadMiddleware } from '../../../shared/utils/cloudinaryService.js';
import userWalletRoutes from './userWalletRoutes.js';
import complaintRoutes from './complaintRoutes.js';

const router = express.Router();

// All routes require user authentication
router.use(authenticate);

// Profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);

// Profile image upload
router.post(
  '/profile/avatar',
  uploadMiddleware.single('image'),
  uploadProfileImage
);

// Location routes
router.get('/location', getUserLocation);
router.put('/location', updateUserLocation);

// Address routes
router.get('/addresses', getUserAddresses);
router.post('/addresses', addUserAddress);
router.put('/addresses/:id', updateUserAddress);
router.delete('/addresses/:id', deleteUserAddress);

// FCM Web Push token registration
router.post('/fcm-token', async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'Token required' });
    const normalizedToken = String(token).trim();
    if (!normalizedToken) return res.status(400).json({ success: false, message: 'Token required' });

    const normalizedPlatform = String(platform).toLowerCase();
    const tokenField = normalizedPlatform === 'mobile' ? 'fcmTokenMobile' : 'fcmTokenWeb';

    const User = (await import('../../auth/models/User.js')).default;
    // Keep legacy token array for backward compatibility and also store platform-specific token.
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $addToSet: { fcmTokens: normalizedToken },
        $set: { [tokenField]: normalizedToken },
      }
    );

    // If over 10 tokens, trim oldest
    const user = await User.findById(req.user._id).select('fcmTokens');
    if (user.fcmTokens.length > 10) {
      user.fcmTokens = user.fcmTokens.slice(-10);
      await user.save();
    }
    return res.json({
      success: true,
      message: 'FCM token saved',
      data: { platform: normalizedPlatform === 'mobile' ? 'mobile' : 'web' },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Wallet routes
router.use('/wallet', userWalletRoutes);

// Complaint routes
router.use('/complaints', complaintRoutes);

export default router;
