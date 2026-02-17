
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
            rank,
        });

        return successResponse(res, 201, "Tier created successfully", tier);
    } catch (error) {
        console.error("Error creating tier:", error);
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
        const { name, minArea, maxArea, description, rank, isActive } = req.body;

        const tier = await Tier.findById(id);
        if (!tier) {
            return errorResponse(res, 404, "Tier not found");
        }

        if (name) tier.name = name;
        if (minArea !== undefined) tier.minArea = minArea;
        if (maxArea !== undefined) tier.maxArea = maxArea;
        if (description) tier.description = description;
        if (rank) tier.rank = rank;
        if (isActive !== undefined) tier.isActive = isActive;

        await tier.save();

        // TODO: Optionally re-calculate zones if area ranges changed
        // This could be an expensive operation, so maybe we trigger it manually or asynchronously

        return successResponse(res, 200, "Tier updated successfully", tier);
    } catch (error) {
        console.error("Error updating tier:", error);
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

        if (!zone.boundary || !zone.boundary.coordinates) {
            return errorResponse(res, 400, "Zone has no boundary defined");
        }

        // 1. Find Restaurants in Zone
        const restaurants = await Restaurant.find({
            "location.coordinates": {
                $geoWithin: {
                    $geometry: zone.boundary
                }
            }
        }).select('restaurantId name location.address ownerName ownerPhone rating totalRatings image profileImage isAcceptingOrders').lean();

        if (restaurants.length === 0) {
            return successResponse(res, 200, "No restaurants found in this zone", []);
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
