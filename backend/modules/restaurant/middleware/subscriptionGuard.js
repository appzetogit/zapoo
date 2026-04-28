import { errorResponse } from '../../../shared/utils/response.js';
import { splitFeatureKeysByValidity, normalizeFeatureKey } from '../../subscription/constants/featureCatalog.js';

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

    // If subscription is active, check features.
    // Use a merged set from both subscription snapshot + current plan features.
    // This handles stale/incomplete snapshots while preserving valid legacy values.
    const readFeatureKeys = (source) => {
      if (!Array.isArray(source)) return [];
      return source.map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return item.key || item.feature || item.name || "";
        }
        return "";
      }).filter(Boolean);
    };

    const snapshotFeatures = splitFeatureKeysByValidity(
      readFeatureKeys(subscription.features)
    ).valid;
    const planFeatures = splitFeatureKeysByValidity(
      readFeatureKeys(subscription.planId?.features)
    ).valid;
    const effectiveFeatures = [...new Set([...snapshotFeatures, ...planFeatures])];
    const requiredFeature = normalizeFeatureKey(feature);

    if (effectiveFeatures.includes(requiredFeature)) {
      return next();
    }

    return errorResponse(res, 403, `Your current plan does not include access to '${feature}'. Please upgrade your subscription.`);
  };
};
