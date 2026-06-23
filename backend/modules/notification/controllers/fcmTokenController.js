import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';

async function updateModelToken(userId, role, token, targetArray) {
    if (!userId || !token) return;

    try {
        let Model;
        if (role === 'user') {
            Model = (await import('../../auth/models/User.js')).default;
        } else if (role === 'restaurant') {
            Model = (await import('../../restaurant/models/Restaurant.js')).default;
        } else if (role === 'delivery' || role === 'DELIVERY_PARTNER') {
            const { FoodDeliveryPartner } = await import('../../deliveryV2/models/deliveryPartner.model.js');
            const Delivery = (await import('../../delivery/models/Delivery.js')).default;

            // Try V2 first, if not found fallback to V1
            let doc = await FoodDeliveryPartner.findById(userId).select(`${targetArray}`);
            if (doc) {
                Model = FoodDeliveryPartner;
            } else {
                Model = Delivery;
            }
        } else if (role === 'admin') {
            Model = (await import('../../admin/models/Admin.js')).default;
        } else {
            return; // Not supported for others currently
        }

        const normalizedToken = token.trim();
        const updateDoc = await Model.findById(userId).select(`${targetArray}`);
        if (!updateDoc) return;

        if (!updateDoc[targetArray]) updateDoc[targetArray] = [];
        if (!updateDoc[targetArray].includes(normalizedToken)) {
            updateDoc[targetArray].push(normalizedToken);
        }
        if (updateDoc[targetArray].length > 10) {
            updateDoc[targetArray] = updateDoc[targetArray].slice(-10);
        }
        await updateDoc.save();
    } catch (err) {
        console.warn(`[FCM-Backend] Failed to save ${targetArray} for ${role} ${userId}:`, err.message);
    }
}

export const saveWebToken = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return errorResponse(res, 400, 'FCM token is required');

    // unified role and userId from custom auth middleware
    const { userId, role } = req.user || {};
    if (!userId || !role) return errorResponse(res, 401, 'Unauthorized or unknown role');

    await updateModelToken(userId, role, token, 'fcmTokenWeb');
    return successResponse(res, 200, 'Web token saved successfully');
});

export const saveMobileToken = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return errorResponse(res, 400, 'FCM token is required');

    const { userId, role } = req.user || {};
    if (!userId || !role) return errorResponse(res, 401, 'Unauthorized or unknown role');

    await updateModelToken(userId, role, token, 'fcmTokenMobile');
    return successResponse(res, 200, 'Mobile token saved successfully');
});

async function removeTokenFromModel(userId, role, token) {
    if (!userId || !token) return false;

    const normalizedToken = String(token).trim();
    let Model;

    if (role === 'user') {
        Model = (await import('../../auth/models/User.js')).default;
    } else if (role === 'restaurant') {
        Model = (await import('../../restaurant/models/Restaurant.js')).default;
    } else if (role === 'delivery' || role === 'DELIVERY_PARTNER') {
        const { FoodDeliveryPartner } = await import('../../deliveryV2/models/deliveryPartner.model.js');
        const Delivery = (await import('../../delivery/models/Delivery.js')).default;
        let doc = await FoodDeliveryPartner.findById(userId).select('_id');
        Model = doc ? FoodDeliveryPartner : Delivery;
    } else if (role === 'admin') {
        Model = (await import('../../admin/models/Admin.js')).default;
    } else {
        return false;
    }

    const updated = await Model.findByIdAndUpdate(
        userId,
        {
            $pull: {
                fcmTokenWeb: normalizedToken,
                fcmTokenMobile: normalizedToken,
                fcmTokenApp: normalizedToken,
                fcmTokens: normalizedToken,
                deviceToken: normalizedToken,
            },
        },
        { new: true }
    );

    return Boolean(updated);
}

export const removeDeviceToken = asyncHandler(async (req, res) => {
    const { token } = req.body || {};
    if (!token) return errorResponse(res, 400, 'FCM token is required');

    const { userId, role } = req.user || {};
    if (!userId || !role) return errorResponse(res, 401, 'Unauthorized or unknown role');

    await removeTokenFromModel(userId, role, token);
    return successResponse(res, 200, 'Device token removed successfully');
});

export { removeTokenFromModel };
