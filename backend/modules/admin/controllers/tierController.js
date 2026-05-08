import Tier from "../models/Tier.js";
import Zone from "../models/Zone.js";
import FeeSettings from "../models/FeeSettings.js";
import { errorResponse, successResponse } from "../../../shared/utils/response.js";
import { syncCommissionRulesForTier } from "../services/deliveryCommissionSyncService.js";
const normalizeDistanceSlabs = (distanceSlabs = []) => distanceSlabs.map(slab => ({
  _id: slab._id,
  name: String(slab.name || "").trim(),
  minKm: Number(slab.minKm),
  maxKm: slab.maxKm === null || slab.maxKm === undefined || slab.maxKm === "" ? null : Number(slab.maxKm),
  isBaseSlab: slab.isBaseSlab === true,
  adminPerKmRate: Number(slab.adminPerKmRate || 0),
  isActive: slab.isActive !== false
}));
const validateDistanceSlabs = (distanceSlabs = []) => {
  if (!Array.isArray(distanceSlabs) || distanceSlabs.length === 0) {
    return "distanceSlabs must be a non-empty array";
  }
  const baseSlabCount = distanceSlabs.filter(slab => slab.isBaseSlab === true).length;
  if (baseSlabCount !== 1) {
    return "Exactly one base distance slab is required per tier";
  }
  for (const slab of distanceSlabs) {
    if (!slab.name || !String(slab.name).trim()) {
      return "Each distance slab must have a name";
    }
    if (slab.minKm === undefined || Number(slab.minKm) < 0) {
      return "Each distance slab must have minKm >= 0";
    }
    if (slab.maxKm !== null && slab.maxKm !== undefined && slab.maxKm !== "" && Number(slab.maxKm) <= Number(slab.minKm)) {
      return "Each distance slab maxKm must be greater than minKm (or null)";
    }
    if (slab.adminPerKmRate === undefined || Number(slab.adminPerKmRate) < 0) {
      return "Each distance slab must have adminPerKmRate >= 0";
    }
  }
  return null;
};
const checkTierOverlap = async (minArea, maxArea, excludeTierId = null) => {
  const query = {
    minArea: {
      $lt: maxArea
    },
    maxArea: {
      $gt: minArea
    }
  };
  if (excludeTierId) {
    query._id = {
      $ne: excludeTierId
    };
  }
  return await Tier.findOne(query);
};

const getActiveFeeSettingsForTierSync = async () => {
  const feeSettings = await FeeSettings.findOne({ isActive: true })
    .sort({ createdAt: -1 })
    .lean();

  return {
    deliveryFee: Number(feeSettings?.deliveryFee ?? 25),
    freeDeliveryThreshold: Number(feeSettings?.freeDeliveryThreshold ?? 149),
    platformFee: Number(feeSettings?.platformFee ?? 5),
    recommendedItemFee: Number(feeSettings?.recommendedItemFee ?? 0),
  };
};

/**
 * Create a new Tier
 */
export const createTier = async (req, res) => {
  try {
    const {
      name,
      minArea,
      maxArea,
      description,
      rank,
      recommendedItemFee,
      platformFee,
      restaurantBannerPricePerDay,
      baseDistance,
      extraKmCharge,
      basePay,
      distanceSlabs
    } = req.body;

    const feeSettings = await getActiveFeeSettingsForTierSync();

    // Check if rank already exists
    const existingRank = await Tier.findOne({
      rank
    });
    if (existingRank) {
      return errorResponse(res, 400, "Tier with this rank already exists");
    }

    // Check if name already exists
    const existingName = await Tier.findOne({
      name
    });
    if (existingName) {
      return errorResponse(res, 400, "Tier with this name already exists");
    }
    const safeDistanceSlabs = Array.isArray(distanceSlabs) ? distanceSlabs : [];
    if (safeDistanceSlabs.length > 0) {
      const validationError = validateDistanceSlabs(safeDistanceSlabs);
      if (validationError) {
        return errorResponse(res, 400, validationError);
      }
    }
    if (Number(minArea) < 0) {
      return errorResponse(res, 400, "minArea must be greater than or equal to 0");
    }
    if (Number(maxArea) < 1) {
      return errorResponse(res, 400, "maxArea must be greater than or equal to 1");
    }
    if (minArea >= maxArea) {
      return errorResponse(res, 400, "minArea must be less than maxArea");
    }
    const overlappingTier = await checkTierOverlap(minArea, maxArea);
    if (overlappingTier) {
      return errorResponse(res, 400, `Tier area range overlaps with existing tier: ${overlappingTier.name}`);
    }
    const tier = await Tier.create({
      name,
      minArea,
      maxArea,
      description,
      description,
      rank,
      deliveryPricing: {
        basePay: basePay || 0,
        baseFee: feeSettings.deliveryFee,
        freeDeliveryThreshold: feeSettings.freeDeliveryThreshold,
        baseDistance: baseDistance || 3,
        extraKmCharge: extraKmCharge || 10,
        distanceSlabs: normalizeDistanceSlabs(safeDistanceSlabs)
      },
      recommendedItemFee: feeSettings.recommendedItemFee,
      platformFee: platformFee !== undefined ? Number(platformFee) : feeSettings.platformFee,
      restaurantBannerPricePerDay: restaurantBannerPricePerDay !== undefined ? Number(restaurantBannerPricePerDay) : 500
    });

    // Sync delivery commission rules for this tier based on its distance slabs
    try {
      await syncCommissionRulesForTier({
        tierName: tier.name,
        deliveryPricing: tier.deliveryPricing,
        adminId: req.admin?._id || null
      });
    } catch (syncError) {
      console.error("Error syncing delivery commission rules for new tier:", syncError);
    }

    // Re-evaluate zone tiers after creating a new tier so eligible zones get assigned
    try {
      const allZonesToUpdate = await Zone.find({});
      for (const z of allZonesToUpdate) {
        await z.recalculateBoundaryAreaAndTier();
        if (z.isModified()) {
          await z.save();
        }
      }
    } catch (zoneRecalcError) {
      console.error("Error re-evaluating zones after tier create:", zoneRecalcError);
    }

    return successResponse(res, 201, "Tier created successfully", tier);
  } catch (error) {
    console.error("Error creating tier:", error);
    if (error.code === 11000) {
      return errorResponse(res, 400, "Duplicate error: Name or Rank must be unique");
    }
    return errorResponse(res, 500, "Failed to create tier", error.message);
  }
};

/**
 * Get all Tiers
 */
export const getAllTiers = async (req, res) => {
  try {
    const tiers = await Tier.find().sort({
      rank: 1
    });
    return successResponse(res, 200, "Tiers fetched successfully", tiers);
  } catch (error) {
    console.error("Error fetching tiers:", error);
    return errorResponse(res, 500, "Failed to fetch tiers", error.message);
  }
};

/**
 * Update a Tier
 */
export const updateTier = async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      name,
      minArea,
      maxArea,
      description,
      rank,
      isActive,
      baseFee,
      freeDeliveryThreshold,
      maxBanners,
      recommendedItemFee,
      platformFee,
      restaurantBannerPricePerDay,
      baseDistance,
      extraKmCharge,
      basePay,
      distanceSlabs
    } = req.body;
    const tier = await Tier.findById(id);
    if (!tier) {
      return errorResponse(res, 404, "Tier not found");
    }

    const prevBaseFee = tier.deliveryPricing?.baseFee;
    const prevFreeDeliveryThreshold = tier.deliveryPricing?.freeDeliveryThreshold;

    // Check for duplicate name if changing
    if (name && name !== tier.name) {
      const existingName = await Tier.findOne({
        name,
        _id: {
          $ne: id
        }
      });
      if (existingName) {
        return errorResponse(res, 400, "Tier with this name already exists");
      }
      tier.name = name;
    }

    // Check for duplicate rank if changing
    if (rank && rank !== tier.rank) {
      const existingRank = await Tier.findOne({
        rank,
        _id: {
          $ne: id
        }
      });
      if (existingRank) {
        return errorResponse(res, 400, "Tier with this rank already exists");
      }
      tier.rank = rank;
    }
    if (minArea !== undefined) tier.minArea = minArea;
    if (maxArea !== undefined) tier.maxArea = maxArea;
    if (description) tier.description = description;
    if (isActive !== undefined) tier.isActive = isActive;
    if (minArea !== undefined || maxArea !== undefined) {
      const checkMin = minArea !== undefined ? minArea : tier.minArea;
      const checkMax = maxArea !== undefined ? maxArea : tier.maxArea;
      if (Number(checkMin) < 0) {
        return errorResponse(res, 400, "minArea must be greater than or equal to 0");
      }
      if (Number(checkMax) < 1) {
        return errorResponse(res, 400, "maxArea must be greater than or equal to 1");
      }
      if (checkMin >= checkMax) {
        return errorResponse(res, 400, "minArea must be less than maxArea");
      }
      const overlappingTier = await checkTierOverlap(checkMin, checkMax, id);
      if (overlappingTier) {
        return errorResponse(res, 400, `Tier area range overlaps with existing tier: ${overlappingTier.name}`);
      }
    }
    if (distanceSlabs !== undefined) {
      const validationError = validateDistanceSlabs(distanceSlabs);
      if (validationError) {
        return errorResponse(res, 400, validationError);
      }
    }

    // Update delivery pricing (distance slabs can be updated without touching fees)
    if (
      baseDistance !== undefined ||
      extraKmCharge !== undefined ||
      basePay !== undefined ||
      distanceSlabs !== undefined
    ) {
      if (!tier.deliveryPricing) tier.deliveryPricing = {};
      if (basePay !== undefined) tier.deliveryPricing.basePay = basePay;
      if (baseDistance !== undefined) tier.deliveryPricing.baseDistance = baseDistance;
      if (extraKmCharge !== undefined) tier.deliveryPricing.extraKmCharge = extraKmCharge;
      if (distanceSlabs !== undefined) tier.deliveryPricing.distanceSlabs = normalizeDistanceSlabs(distanceSlabs);
    }

    // Set fees only when the caller provides them.
    // This prevents tier fees from being overwritten by unrelated updates
    // (e.g. TierManagement updating only basePay).
    if (!tier.deliveryPricing) tier.deliveryPricing = {};
    if (baseFee !== undefined) tier.deliveryPricing.baseFee = Number(baseFee);
    if (freeDeliveryThreshold !== undefined) tier.deliveryPricing.freeDeliveryThreshold = Number(freeDeliveryThreshold);

    // Update tier-based banner limit
    if (maxBanners !== undefined) {
      tier.maxBanners = Math.max(1, parseInt(maxBanners) || 1);
    }

    if (recommendedItemFee !== undefined) {
      tier.recommendedItemFee = Number(recommendedItemFee);
    }
    if (platformFee !== undefined) {
      tier.platformFee = Number(platformFee);
    }
    if (restaurantBannerPricePerDay !== undefined) {
      tier.restaurantBannerPricePerDay = Number(restaurantBannerPricePerDay);
    }

    const feeSettingsChanged =
      (baseFee !== undefined && Number(prevBaseFee ?? 0) !== Number(baseFee)) ||
      (freeDeliveryThreshold !== undefined && Number(prevFreeDeliveryThreshold ?? 0) !== Number(freeDeliveryThreshold));
    await tier.save();

    // Sync delivery commission rules whenever tier delivery pricing / slabs change
    try {
      await syncCommissionRulesForTier({
        tierName: tier.name,
        deliveryPricing: tier.deliveryPricing,
        adminId: req.admin?._id || null
      });
    } catch (syncError) {
      console.error("Error syncing delivery commission rules for updated tier:", syncError);
    }

    // Propagate pricing to non-overridden zones
    if (
      baseFee !== undefined ||
      freeDeliveryThreshold !== undefined ||
      baseDistance !== undefined ||
      extraKmCharge !== undefined ||
      basePay !== undefined ||
      feeSettingsChanged
    ) {
      await Zone.updateMany({
        tierId: id,
        $or: [{
          "deliveryPricing.isOverridden": false
        }, {
          "deliveryPricing.isOverridden": {
            $exists: false
          }
        }]
      }, {
        $set: {
          "deliveryPricing.basePay": tier.deliveryPricing.basePay,
          "deliveryPricing.baseFee": tier.deliveryPricing.baseFee,
          "deliveryPricing.freeDeliveryThreshold": tier.deliveryPricing.freeDeliveryThreshold,
          "deliveryPricing.baseDistance": tier.deliveryPricing.baseDistance,
          "deliveryPricing.extraKmCharge": tier.deliveryPricing.extraKmCharge,
          "deliveryPricing.lastUpdated": new Date()
        }
      });
    }

    // Re-evaluate zone tiers if area range changed
    if (minArea !== undefined || maxArea !== undefined) {
      const allZonesToUpdate = await Zone.find({});
      for (const z of allZonesToUpdate) {
        await z.recalculateBoundaryAreaAndTier();
        if (z.isModified()) {
          await z.save();
        }
      }
    }
    return successResponse(res, 200, "Tier updated successfully", tier);
  } catch (error) {
    console.error("Error updating tier:", error);
    if (error.code === 11000) {
      return errorResponse(res, 400, "Duplicate error: Name or Rank must be unique");
    }
    if (error.name === 'ValidationError') {
      return errorResponse(res, 400, "Validation Error", error.message);
    }
    return errorResponse(res, 500, "Failed to update tier", error.message);
  }
};

/**
 * Delete a Tier
 */
export const deleteTier = async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const tier = await Tier.findById(id);
    if (!tier) {
      return errorResponse(res, 404, "Tier not found");
    }

    // Remove tierId from zones specifically associated with this tier without throwing errors
    // Then re-save all previously associated zones to assign them to possible lower tiers if available
    const allZonesInTier = await Zone.find({
      tierId: id
    });
    await Tier.findByIdAndDelete(id);
    for (const z of allZonesInTier) {
      const fullZone = await Zone.findById(z._id);
      if (fullZone) await fullZone.save();
    }
    return successResponse(res, 200, "Tier deleted successfully");
  } catch (error) {
    console.error("Error deleting tier:", error);
    return errorResponse(res, 500, "Failed to delete tier", error.message);
  }
};
import Order from "../../order/models/Order.js";
import Restaurant from "../../restaurant/models/Restaurant.js";

/**
 * Get Zones by Tier
 */
export const getZonesByTier = async (req, res) => {
  try {
    const {
      id
    } = req.params;

    // simple check if tier exists
    const tier = await Tier.findById(id);
    if (!tier) {
      return errorResponse(res, 404, "Tier not found");
    }
    const zones = await Zone.find({
      tierId: id
    }).select('name serviceLocation area coordinates isActive');
    return successResponse(res, 200, "Zones fetched successfully", zones);
  } catch (error) {
    console.error("Error fetching zones by tier:", error);
    return errorResponse(res, 500, "Failed to fetch zones", error.message);
  }
};

/**
 * Get Restaurants by Zone with Performance Metrics
 */
export const getRestaurantsByZone = async (req, res) => {
  try {
    const {
      zoneId
    } = req.params;
    const {
      filter
    } = req.query; // 'best', 'underperforming', 'average'

    const zone = await Zone.findById(zoneId);
    if (!zone) {
      return errorResponse(res, 404, "Zone not found");
    }

    const getRestaurantImageUrl = (restaurant) => {
      if (!restaurant) return "";
      return restaurant.profileImage?.url ||
        restaurant.profileImage ||
        restaurant.image?.url ||
        restaurant.image ||
        "";
    };

    const getRestaurantLocationLabel = (location) => {
      if (!location) return "";
      return location.formattedAddress ||
        location.address ||
        [location.building, location.area, location.city, location.landmark]
          .filter(Boolean)
          .join(", ");
    };

    // 1. Find Restaurants in Zone — query by zoneId (set during onboarding auto-detection)
    const restaurants = await Restaurant.find({
      zoneId: zone._id
    }).select('restaurantId name slug location ownerName ownerPhone rating totalRatings image profileImage isAcceptingOrders').lean();
    if (restaurants.length === 0) {
      return successResponse(res, 200, "No restaurants found in this zone", {
        zone: {
          name: zone.name,
          id: zone._id
        },
        restaurants: [],
        meta: {
          avgRevenue: 0,
          totalRestaurants: 0
        }
      });
    }
    const restaurantIds = Array.from(new Set(
      restaurants
        .flatMap(r => {
          const ids = [];
          if (r.restaurantId) ids.push(String(r.restaurantId));
          if (r._id) ids.push(String(r._id));
          return ids;
        })
        .filter(Boolean)
    ));

    // 2. Aggregate Orders (revenue + order counts)
    const orderStats = await Order.aggregate([{
      $match: {
        restaurantId: {
          $in: restaurantIds
        },
        status: 'delivered' // Only count delivered orders for revenue
      }
    }, {
      $group: {
        _id: "$restaurantId",
        totalRevenue: {
          $sum: "$pricing.total"
        },
        totalOrders: {
          $sum: 1
        }
      }
    }]);

    // 3. Aggregate Ratings (real ratings from order reviews)
    const ratingStats = await Order.aggregate([{
      $match: {
        restaurantId: {
          $in: restaurantIds
        },
        'review.rating': { $exists: true, $ne: null }
      }
    }, {
      $group: {
        _id: "$restaurantId",
        ratingSum: { $sum: "$review.rating" },
        ratingCount: { $sum: 1 }
      }
    }]);

    // Map stats to restaurants (by restaurantId stored in orders)
    const statsMap = {};
    orderStats.forEach(stat => {
      statsMap[String(stat._id)] = stat;
    });

    const ratingMap = {};
    ratingStats.forEach(stat => {
      ratingMap[String(stat._id)] = stat;
    });

    const getCombinedStats = (restaurant) => {
      const idA = restaurant.restaurantId ? String(restaurant.restaurantId) : null;
      const idB = restaurant._id ? String(restaurant._id) : null;
      const statsA = idA ? (statsMap[idA] || { totalRevenue: 0, totalOrders: 0 }) : { totalRevenue: 0, totalOrders: 0 };
      const statsB = idB && idB !== idA ? (statsMap[idB] || { totalRevenue: 0, totalOrders: 0 }) : { totalRevenue: 0, totalOrders: 0 };
      return {
        revenue: statsA.totalRevenue + statsB.totalRevenue,
        orders: statsA.totalOrders + statsB.totalOrders
      };
    };

    const getCombinedRating = (restaurant) => {
      const idA = restaurant.restaurantId ? String(restaurant.restaurantId) : null;
      const idB = restaurant._id ? String(restaurant._id) : null;
      const statsA = idA ? (ratingMap[idA] || { ratingSum: 0, ratingCount: 0 }) : { ratingSum: 0, ratingCount: 0 };
      const statsB = idB && idB !== idA ? (ratingMap[idB] || { ratingSum: 0, ratingCount: 0 }) : { ratingSum: 0, ratingCount: 0 };
      const ratingSum = statsA.ratingSum + statsB.ratingSum;
      const ratingCount = statsA.ratingCount + statsB.ratingCount;
      return {
        rating: ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : 0,
        totalRatings: ratingCount
      };
    };

    const perRestaurantStats = restaurants.map(r => getCombinedStats(r));
    const totalRevenue = perRestaurantStats.reduce((sum, stat) => sum + stat.revenue, 0);
    const avgRevenue = restaurants.length > 0 ? totalRevenue / restaurants.length : 0;

    // 3. Categorize and Enrich
    let enrichedRestaurants = restaurants.map(r => {
      const stats = getCombinedStats(r);
      const ratingStats = getCombinedRating(r);
      const revenue = stats.revenue;
      let performance = 'average';
      // Simple logic: > 20% above avg = best, < 20% below avg = underperforming
      if (revenue > avgRevenue * 1.2) {
        performance = 'best';
      } else if (revenue < avgRevenue * 0.8) {
        performance = 'underperforming';
      }
      return {
        ...r,
        rating: ratingStats.rating,
        totalRatings: ratingStats.totalRatings,
        imageUrl: getRestaurantImageUrl(r),
        locationLabel: getRestaurantLocationLabel(r.location),
        metrics: {
          revenue,
          orders: stats.orders,
          performance
        }
      };
    });

    // 4. Filter
    if (filter) {
      if (filter === 'best') {
        enrichedRestaurants = enrichedRestaurants.filter(r => r.metrics.performance === 'best');
      } else if (filter === 'underperforming') {
        enrichedRestaurants = enrichedRestaurants.filter(r => r.metrics.performance === 'underperforming');
      } else if (filter === 'average') {
        // Return average + unclassified (if any)
        enrichedRestaurants = enrichedRestaurants.filter(r => r.metrics.performance === 'average');
      }
    }

    // Always sort by revenue descending within the filtered list
    enrichedRestaurants.sort((a, b) => b.metrics.revenue - a.metrics.revenue);
    return successResponse(res, 200, "Restaurants fetched successfully", {
      zone: {
        name: zone.name,
        id: zone._id
      },
      restaurants: enrichedRestaurants,
      meta: {
        avgRevenue,
        totalRestaurants: restaurants.length
      }
    });
  } catch (error) {
    console.error("Error fetching restaurants by zone:", error);
    return errorResponse(res, 500, "Failed to fetch restaurants", error.message);
  }
};
