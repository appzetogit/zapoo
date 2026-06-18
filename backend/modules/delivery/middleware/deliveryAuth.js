import jwtService from '../../auth/services/jwtService.js';
import Delivery from '../models/Delivery.js';
import { errorResponse } from '../../../shared/utils/response.js';

/**
 * Delivery Authentication Middleware
 * Verifies JWT access token and attaches delivery boy to request
 */
export const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 401, 'No token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwtService.verifyAccessToken(token);

    // Ensure it's a delivery token
    if (decoded.role !== 'delivery') {
      return errorResponse(res, 403, 'Invalid token. Delivery access required.');
    }

    // Get delivery boy from database
    let delivery = await Delivery.findById(decoded.userId).select('-password -refreshToken');
    
    if (!delivery) {
      // Try V2 FoodDeliveryPartner as fallback
      const { FoodDeliveryPartner } = await import('../../deliveryV2/models/deliveryPartner.model.js');
      delivery = await FoodDeliveryPartner.findById(decoded.userId);
    }
    
    if (!delivery) {
      console.error('❌ Delivery boy not found in database:', {
        userId: decoded.userId,
        role: decoded.role,
        email: decoded.email,
      });
      return errorResponse(res, 401, 'Delivery boy not found');
    }

    // Allow blocked/pending/rejected status partners to access (they can see rejection reason or verification message)
    // Only block if account is inactive AND not blocked/pending/rejected
    const isActive = delivery.isActive !== false;
    const status = delivery.status;
    const isBlockedOrPending = status === 'blocked' || status === 'pending' || status === 'rejected';

    if (!isActive && !isBlockedOrPending) {
      console.error('❌ Delivery boy account is inactive:', {
        deliveryId: delivery._id,
        deliveryName: delivery.name,
        isActive,
        status,
      });
      return errorResponse(res, 401, 'Delivery boy account is inactive');
    }

    // Attach delivery boy to request
    req.delivery = delivery;
    req.token = decoded;
    
    next();
  } catch (error) {
    return errorResponse(res, 401, error.message || 'Invalid token');
  }
};

export default { authenticate };

