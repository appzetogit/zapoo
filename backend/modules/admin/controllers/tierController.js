
import Tier from "../models/Tier.js";
import Zone from "../models/Zone.js";
import { errorResponse, successResponse } from "../../../shared/utils/response.js";

/**
 * Create a new Tier
 */
export const createTier = async (req, res) => {
    try {
        const { name, minArea, maxArea, description, rank } = req.body;

        // Check if rank already exists
        const existingRank = await Tier.findOne({ rank });
        if (existingRank) {
            return errorResponse(res, 400, "Tier with this rank already exists");
        }

        // Check if name already exists
        const existingName = await Tier.findOne({ name });
        if (existingName) {
            return errorResponse(res, 400, "Tier with this name already exists");
        }

        const tier = await Tier.create({
            name,
            minArea,
            maxArea,
            description,
            description,
            rank,
            deliveryPricing: {
                baseFee: req.body.baseFee || 0,
                freeDeliveryThreshold: req.body.freeDeliveryThreshold || 0
            }
        });

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
        const tiers = await Tier.find().sort({ rank: 1 });
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
        const { id } = req.params;
        console.log("updateTier body:", req.body);
        const { name, minArea, maxArea, description, rank, isActive, baseFee, freeDeliveryThreshold } = req.body;

        const tier = await Tier.findById(id);
        if (!tier) {
            return errorResponse(res, 404, "Tier not found");
        }

        // Check for duplicate name if changing
        if (name && name !== tier.name) {
            const existingName = await Tier.findOne({ name, _id: { $ne: id } });
            if (existingName) {
                return errorResponse(res, 400, "Tier with this name already exists");
            }
            tier.name = name;
        }

        // Check for duplicate rank if changing
        if (rank && rank !== tier.rank) {
            const existingRank = await Tier.findOne({ rank, _id: { $ne: id } });
            if (existingRank) {
                return errorResponse(res, 400, "Tier with this rank already exists");
            }
            tier.rank = rank;
        }

        if (minArea !== undefined) tier.minArea = minArea;
        if (maxArea !== undefined) tier.maxArea = maxArea;
        if (description) tier.description = description;
        if (isActive !== undefined) tier.isActive = isActive;

        // Update delivery pricing
        if (baseFee !== undefined || freeDeliveryThreshold !== undefined) {
            if (!tier.deliveryPricing) {
                tier.deliveryPricing = {};
            }
            if (baseFee !== undefined) tier.deliveryPricing.baseFee = baseFee;
            if (freeDeliveryThreshold !== undefined) tier.deliveryPricing.freeDeliveryThreshold = freeDeliveryThreshold;
        }

        await tier.save();

        // Propagate pricing to non-overridden zones
        if (baseFee !== undefined || freeDeliveryThreshold !== undefined) {
            await Zone.updateMany(
                {
                    tierId: id,
                    $or: [
                        { "deliveryPricing.isOverridden": false },
                        { "deliveryPricing.isOverridden": { $exists: false } }
                    ]
                },
                {
                    $set: {
                        "deliveryPricing.baseFee": tier.deliveryPricing.baseFee,
                        "deliveryPricing.freeDeliveryThreshold": tier.deliveryPricing.freeDeliveryThreshold,
                        "deliveryPricing.lastUpdated": new Date()
                    }
                }
            );
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
        const { id } = req.params;

        const tier = await Tier.findById(id);
        if (!tier) {
            return errorResponse(res, 404, "Tier not found");
        }

        await Tier.findByIdAndDelete(id);

        // Unset tierId from Zones that were using this tier
        await Zone.updateMany({ tierId: id }, { $unset: { tierId: "" } });

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
        const { id } = req.params;

        // simple check if tier exists
        const tier = await Tier.findById(id);
        if (!tier) {
            return errorResponse(res, 404, "Tier not found");
        }

        const zones = await Zone.find({ tierId: id }).select('name serviceLocation area coordinates');

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
        const { zoneId } = req.params;
        const { filter } = req.query; // 'best', 'underperforming', 'average'

        const zone = await Zone.findById(zoneId);
        if (!zone) {
            return errorResponse(res, 404, "Zone not found");
        }

        // 1. Find Restaurants in Zone — query by zoneId (set during onboarding auto-detection)
        const restaurants = await Restaurant.find({
            zoneId: zone._id
        }).select('restaurantId name location ownerName ownerPhone rating totalRatings image profileImage isAcceptingOrders').lean();

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

        const restaurantIds = restaurants.map(r => r.restaurantId);

        // 2. Aggregate Orders
        const orderStats = await Order.aggregate([
            {
                $match: {
                    restaurantId: { $in: restaurantIds },
                    status: 'delivered' // Only count delivered orders for revenue
                }
            },
            {
                $group: {
                    _id: "$restaurantId",
                    totalRevenue: { $sum: "$pricing.total" },
                    totalOrders: { $sum: 1 }
                }
            }
        ]);

        // Map stats to restaurants
        const statsMap = {};
        let grandTotalRevenue = 0;
        let grandTotalOrders = 0;

        orderStats.forEach(stat => {
            statsMap[stat._id] = stat;
            grandTotalRevenue += stat.totalRevenue;
            grandTotalOrders += stat.totalOrders;
        });

        const avgRevenue = restaurants.length > 0 ? grandTotalRevenue / restaurants.length : 0;

        // 3. Categorize and Enrich
        let enrichedRestaurants = restaurants.map(r => {
            const stats = statsMap[r.restaurantId] || { totalRevenue: 0, totalOrders: 0 };
            const revenue = stats.totalRevenue;

            let performance = 'average';
            // Simple logic: > 20% above avg = best, < 20% below avg = underperforming
            if (revenue > avgRevenue * 1.2) {
                performance = 'best';
            } else if (revenue < avgRevenue * 0.8) {
                performance = 'underperforming';
            }

            return {
                ...r,
                metrics: {
                    revenue,
                    orders: stats.totalOrders,
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
