import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import DeviceToken from '../models/DeviceToken.js';

function normalizeDevicePlatform(platform) {
    const value = String(platform || 'web').toLowerCase().trim();
    if (value === 'ios') return 'ios';
    if (value === 'android' || value === 'app' || value === 'mobile') return 'android';
    return 'web';
}

function getArrayFieldByPlatform(normalizedPlatform) {
    return normalizedPlatform === 'web' ? 'fcmTokensWeb' : 'fcmTokensMobile';
}

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
    const normalizedPlatform = normalizeDevicePlatform(platform);
    console.log(`[FCM-Backend] Request to save token: role=${role}, deviceToken=${deviceToken.substring(0, 10)}..., platform=${normalizedPlatform}`);
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
        { userId, role, deviceToken },
        { userId, role, deviceToken, platform: normalizedPlatform, isActive: true },
        { upsert: true, new: true }
    );

    // Sync role-specific document fields so web/app tokens are visible in each module collection.
    try {
        const tokenArrayField = getArrayFieldByPlatform(normalizedPlatform);

        if (role === 'user') {
            const { default: User } = await import('../../auth/models/User.js');
            const pullPayload = { [tokenArrayField]: deviceToken };
            const pushPayload = { [tokenArrayField]: { $each: [deviceToken], $slice: -10 } };

            await User.findByIdAndUpdate(userId, {
                $pull: pullPayload,
                $push: pushPayload
            });
        } else if (role === 'restaurant') {
            const { default: Restaurant } = await import('../../restaurant/models/Restaurant.js');
            const pullPayload = { [tokenArrayField]: deviceToken };
            const pushPayload = { [tokenArrayField]: { $each: [deviceToken], $slice: -10 } };
            await Restaurant.findByIdAndUpdate(userId, {
                $pull: pullPayload,
                $push: pushPayload
            });
        } else if (role === 'delivery') {
            const { default: Delivery } = await import('../../delivery/models/Delivery.js');
            const pullPayload = { [tokenArrayField]: deviceToken };
            const pushPayload = { [tokenArrayField]: { $each: [deviceToken], $slice: -10 } };

            await Delivery.findByIdAndUpdate(userId, {
                $pull: pullPayload,
                $push: pushPayload
            });
        }
    } catch (syncErr) {
        // Do not break token registration if legacy/module-field sync fails.
        console.warn(`[FCM-Backend] Module FCM field sync failed: ${syncErr.message}`);
    }

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
