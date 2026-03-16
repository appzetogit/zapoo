import { errorResponse } from '../../../shared/utils/response.js';

/**
 * Middleware to check if restaurant has access to a specific feature
 * @param {string} feature - The feature identifier to check
 */
export const checkFeatureAccess = (feature) => {
  return (req, res, next) => {
    const restaurant = req.restaurant;

    if (!restaurant) {
      return errorResponse(res, 401, 'Restaurant authentication required');
    }

    const subscription = restaurant.subscription;
    
    // Check if subscription exists and is active
    // The main auth middleware already handles JIT expiry check, 
    // but we check here too for safety.
    const now = new Date();
    const isExpiredByDate = subscription?.endDate ? new Date(subscription.endDate) <= now : true;
    if (!subscription || subscription.status !== 'active' || isExpiredByDate) {
      return errorResponse(res, 403, 'An active subscription is required to access this feature.');
    }

    // If subscription is active, check features
    // In our model, features are stored as an array of strings
    if (Array.isArray(subscription.features) && subscription.features.includes(feature)) {
      return next();
    }

    return errorResponse(res, 403, `Your current plan does not include access to '${feature}'. Please upgrade your subscription.`);
  };
};
