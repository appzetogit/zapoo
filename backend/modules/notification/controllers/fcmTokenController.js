import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import DeviceToken from '../models/DeviceToken.js';

/**
 * Unified endpoint to save FCM device tokens.
 * Works for users, restaurants, delivery partners, and admins.
 */
export const saveDeviceToken = asyncHandler(async (req, res) => {
    const { token, platform = 'web', role } = req.body;

    if (!token) return errorResponse(res, 400, 'FCM token is required');
    if (!role) return errorResponse(res, 400, 'Role is required');

    const deviceToken = String(token).trim();
    console.log(`[FCM-Backend] SAVE REQUEST ARRIVED: role=${role}, bodyRole=${req.body.role}`);

    let userId;
    console.log(`[FCM-Backend] Request to save token: role=${role}, deviceToken=${deviceToken.substring(0, 10)}..., platform=${platform}`);
    switch (role) {
        case 'user':
            userId = req.user?._id;
            console.log(`[FCM-Backend] User role: userId=${userId}, req.user=${!!req.user}`);
            break;
        case 'restaurant':
            userId = req.restaurant?._id || req.user?._id;
            console.log(`[FCM-Backend] Restaurant role: userId=${userId}, req.restaurant=${!!req.restaurant}, req.user=${!!req.user}`);
            break;
        case 'delivery':
            userId = req.delivery?._id || req.deliveryPartner?._id || req.user?._id;
            console.log(`[FCM-Backend] Delivery role: userId=${userId}, req.delivery=${!!req.delivery}, req.deliveryPartner=${!!req.deliveryPartner}`);
            break;
        case 'admin':
            userId = req.admin?._id || req.user?._id;
            console.log(`[FCM-Backend] Admin role: userId=${userId}, req.admin=${!!req.admin}`);
            break;
        default: return errorResponse(res, 400, 'Invalid role');
    }

    console.log(`[FCM-Backend] Resolved userId=${userId} for role=${role}`);

    if (!userId || !deviceToken) {
        console.warn(`[FCM-Backend] Missing identification: userId=${userId}, token=${!!deviceToken}`);
        return errorResponse(res, 400, 'User identification or token missing');
    }

    // Update if exists, or create new
    await DeviceToken.findOneAndUpdate(
        { deviceToken },
        { userId, role, platform: platform.toLowerCase(), isActive: true },
        { upsert: true, new: true }
    );

    // Limit tokens per user/role (e.g., max 5 devices)
    const count = await DeviceToken.countDocuments({ userId, role });
    if (count > 5) {
        const oldest = await DeviceToken.find({ userId, role }).sort({ createdAt: 1 }).limit(count - 5);
        await DeviceToken.deleteMany({ _id: { $in: oldest.map(t => t._id) } });
    }

    return successResponse(res, 201, 'Token saved successfully');
});

/**
 * Remove a device token (e.g., on logout).
 */
export const removeDeviceToken = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return errorResponse(res, 400, 'Token is required');

    await DeviceToken.deleteMany({ deviceToken: token });
    return successResponse(res, 200, 'Token removed successfully');
});
