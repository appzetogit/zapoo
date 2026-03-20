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
    // If endDate is missing (legacy/incomplete data), don't treat it as expired here.
    // Status is still required to be "active".
    const isExpiredByDate = subscription?.endDate ? new Date(subscription.endDate) <= now : false;
    if (!subscription || subscription.status !== 'active' || isExpiredByDate) {
      return errorResponse(res, 403, 'An active subscription is required to access this feature.');
    }

    // If subscription is active, check features
    // In our model, features are stored as an array of strings
    // Some flows (e.g., admin extend) may not persist a snapshot to subscription.features.
    // Fall back to the populated plan's features when snapshot is missing/empty.
    const snapshotFeatures = Array.isArray(subscription.features) ? subscription.features : [];
    const planFeatures = Array.isArray(subscription.planId?.features) ? subscription.planId.features : [];
    const effectiveFeatures = snapshotFeatures.length > 0 ? snapshotFeatures : planFeatures;

    if (Array.isArray(effectiveFeatures) && effectiveFeatures.includes(feature)) {
      return next();
    }

    return errorResponse(res, 403, `Your current plan does not include access to '${feature}'. Please upgrade your subscription.`);
  };
};
