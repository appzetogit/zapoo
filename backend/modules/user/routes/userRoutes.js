import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
  updateUserLocation,
  getUserLocation,
  getUserPreferences,
  updateUserPreferences,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  deleteUserAccount
} from '../controllers/userController.js';
import { authenticate } from '../../auth/middleware/auth.js';
import { uploadMiddleware } from '../../../shared/utils/cloudinaryService.js';
import userWalletRoutes from './userWalletRoutes.js';
import complaintRoutes from './complaintRoutes.js';
import DeviceToken from '../../notification/models/DeviceToken.js';

const router = express.Router();

// All routes require user authentication
router.use(authenticate);

// Profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.delete('/profile', deleteUserAccount);

// Profile image upload
router.post(
  '/profile/avatar',
  uploadMiddleware.single('image'),
  uploadProfileImage
);

// Location routes
router.get('/location', getUserLocation);
router.put('/location', updateUserLocation);
router.get('/preferences', getUserPreferences);
router.put('/preferences', updateUserPreferences);

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

    const normalizedPlatform = String(platform || 'web').toLowerCase().trim();
    const isWebPlatform = normalizedPlatform === 'web';
    const tokenField = isWebPlatform ? 'fcmTokenWeb' : 'fcmTokenApp';

    const User = (await import('../../auth/models/User.js')).default;
    // Keep legacy token array for backward compatibility and also store platform-specific token.
    const setPayload = { [tokenField]: normalizedToken };
    if (!isWebPlatform) {
      // Keep legacy alias in sync for old reads.
      setPayload.fcmTokenMobile = normalizedToken;
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { fcmTokens: normalizedToken },
      $set: setPayload,
    });

    // If over 10 tokens, trim oldest
    const user = await User.findById(req.user._id).select('fcmTokens');
    if (user.fcmTokens.length > 10) {
      user.fcmTokens = user.fcmTokens.slice(-10);
      await user.save();
    }

    // Also persist into unified DeviceToken collection for cross-platform broadcasts
    try {
      await DeviceToken.findOneAndUpdate(
        { deviceToken: normalizedToken },
        {
          userId: req.user._id,
          role: 'user',
          platform: normalizedPlatform === 'ios' ? 'ios' : (isWebPlatform ? 'web' : 'android'),
          isActive: true
        },
        { upsert: true, new: true }
      );

      // Enforce a soft limit on number of active tokens per user
      const count = await DeviceToken.countDocuments({ userId: req.user._id, role: 'user' });
      if (count > 5) {
        const oldest = await DeviceToken.find({ userId: req.user._id, role: 'user' })
          .sort({ createdAt: 1 })
          .limit(count - 5);
        await DeviceToken.deleteMany({ _id: { $in: oldest.map(t => t._id) } });
      }
    } catch (deviceErr) {
      // Do not fail the main request if DeviceToken write fails
      console.warn('[FCM] Failed to write DeviceToken record:', deviceErr.message);
    }
    return res.json({
      success: true,
      message: 'FCM token saved',
      data: { platform: isWebPlatform ? 'web' : 'app' },
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
