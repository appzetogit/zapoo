import Admin from "../models/Admin.js";
import Order from "../../order/models/Order.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import Offer from "../../restaurant/models/Offer.js";
import AdminCommission from "../models/AdminCommission.js";
import OrderSettlement from "../../order/models/OrderSettlement.js";
import AdminWallet from "../models/AdminWallet.js";
import Zone from "../models/Zone.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import RestaurantSubscription from "../../restaurant/models/RestaurantSubscription.js";
import User from "../../auth/models/User.js";
import Menu from "../../restaurant/models/Menu.js";
import Delivery from "../../delivery/models/Delivery.js";
import { successResponse, errorResponse } from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import { normalizePhoneNumber } from "../../../shared/utils/phoneUtils.js";
import winston from "winston";
import mongoose from "mongoose";
import { uploadToCloudinary } from "../../../shared/utils/cloudinaryService.js";
import { initializeCloudinary } from "../../../config/cloudinary.js";
import { applyZoneTierToRestaurantById } from "../services/restaurantZoneAssignmentService.js";
import { normalizeLocale } from "../../../shared/i18n/localeConstants.js";
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

/**
 * Get Admin Dashboard Statistics
 * GET /api/admin/dashboard/stats
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  try {
    const {
      tierId,
      period
    } = req.query;
    // Calculate date ranges
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let startDate = null;
    if (period === "today") {
      startDate = new Date(new Date().setHours(0, 0, 0, 0));
    } else if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === "year") {
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    // Filter by Tier if specified
    let orderScopeFilter = {};
    let restaurantScopeFilter = {};
    let deliveryScopeFilter = {};
    let scopedRestaurantObjectIds = [];
    if (tierId && tierId !== "all") {
      const zones = await Zone.find({
        tierId
      }).select("_id").lean();
      const zoneIds = zones.map(z => z._id);
      const zoneIdStrings = zoneIds.map((id) => String(id));
      restaurantScopeFilter = {
        zoneId: {
          $in: zoneIds
        }
      };
      deliveryScopeFilter = {
        "availability.zones": {
          $in: zoneIds
        }
      };

      // Some historical orders may not have zoneId populated.
      // Scope orders by zone OR by mapped restaurants in those zones.
      const tierRestaurants = await Restaurant.find(restaurantScopeFilter)
        .select("_id restaurantId slug")
        .lean();
      scopedRestaurantObjectIds = tierRestaurants.map((restaurant) => restaurant._id).filter(Boolean);
      const scopedOrderRestaurantIds = [...new Set(
        (tierRestaurants || []).flatMap((r) => [
          r?._id ? String(r._id) : null,
          r?.restaurantId ? String(r.restaurantId) : null,
          r?.slug ? String(r.slug) : null,
        ].filter(Boolean))
      )];

      orderScopeFilter = {
        $or: [
          { zoneId: { $in: zoneIdStrings } },
          { restaurantId: { $in: scopedOrderRestaurantIds } }
        ]
      };
    }

    // Base match for orders (delivered and has pricing)
    const orderMatch = {
      status: "delivered",
      "pricing.total": { $exists: true },
      ...orderScopeFilter
    };

    // Period specific match
    const periodOrderMatch = { ...orderMatch };
    if (startDate) {
      periodOrderMatch.createdAt = { $gte: startDate };
    }

    // 1. Unified Aggregation for Revenue and Admin Earnings (Settlements)
    // We'll join Orders with OrderSettlements to get all financial metrics in one go
    const financialStats = await Order.aggregate([
      { $match: periodOrderMatch },
      {
        $lookup: {
          from: "ordersettlements", // Collection name is usually lowercase plural
          let: {
            orderId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    {
                      $toString: {
                        $ifNull: ["$orderId", ""]
                      }
                    },
                    {
                      $toString: "$$orderId"
                    }
                  ]
                }
              }
            }
          ],
          as: "settlement"
        }
      },
      { $unwind: { path: "$settlement", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$pricing.total" },
          totalCommission: { $sum: { $ifNull: ["$settlement.adminEarning.commission", 0] } },
          totalPlatformFee: { $sum: { $ifNull: ["$settlement.adminEarning.platformFee", 0] } },
          totalDeliveryFee: { $sum: { $ifNull: ["$settlement.adminEarning.deliveryFee", 0] } },
          totalGST: { $sum: { $ifNull: ["$settlement.adminEarning.gst", 0] } },
          totalRecommendedFee: { $sum: { $ifNull: ["$settlement.adminEarning.recommendedItemFee", 0] } },
          count: { $sum: 1 },
          // Last 30 days sub-metrics (if needed for the specific 'total' display)
          last30DaysRevenue: {
            $sum: { $cond: [{ $gte: ["$createdAt", last30Days] }, "$pricing.total", 0] }
          },
          last30DaysCommission: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", last30Days] },
                { $ifNull: ["$settlement.adminEarning.commission", 0] },
                0
              ]
            }
          },
          last30DaysPlatformFee: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", last30Days] },
                { $ifNull: ["$settlement.adminEarning.platformFee", 0] },
                0
              ]
            }
          },
          last30DaysDeliveryFee: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", last30Days] },
                { $ifNull: ["$settlement.adminEarning.deliveryFee", 0] },
                0
              ]
            }
          },
          last30DaysGST: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", last30Days] },
                { $ifNull: ["$settlement.adminEarning.gst", 0] },
                0
              ]
            }
          },
          last30DaysRecommendedFee: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", last30Days] },
                { $ifNull: ["$settlement.adminEarning.recommendedItemFee", 0] },
                0
              ]
            }
          }
        }
      }
    ]);

    const stats = financialStats[0] || {
      totalRevenue: 0, totalCommission: 0, totalPlatformFee: 0, totalDeliveryFee: 0, totalGST: 0, totalRecommendedFee: 0,
      last30DaysRevenue: 0, last30DaysCommission: 0, last30DaysPlatformFee: 0, last30DaysDeliveryFee: 0, last30DaysGST: 0, last30DaysRecommendedFee: 0,
      count: 0
    };

    const subscriptionMatch = {
      paymentStatus: "completed",
      ...(startDate
        ? {
            $or: [
              { paymentDate: { $gte: startDate } },
              {
                paymentDate: { $exists: false },
                createdAt: { $gte: startDate }
              }
            ]
          }
        : {})
    };

    if (tierId && tierId !== "all") {
      subscriptionMatch.restaurantId = { $in: scopedRestaurantObjectIds };
    }

    const subscriptionPricingLookupStages = [
      {
        $lookup: {
          from: "restaurants",
          localField: "restaurantId",
          foreignField: "_id",
          as: "restaurant"
        }
      },
      {
        $unwind: {
          path: "$restaurant",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "zones",
          localField: "restaurant.zoneId",
          foreignField: "_id",
          as: "zone"
        }
      },
      {
        $unwind: {
          path: "$zone",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "tiers",
          localField: "zone.tierId",
          foreignField: "_id",
          as: "tier"
        }
      },
      {
        $unwind: {
          path: "$tier",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: "subscriptionplans",
          localField: "planId",
          foreignField: "_id",
          as: "plan"
        }
      },
      {
        $unwind: {
          path: "$plan",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $addFields: {
          effectiveAmount: {
            $cond: [
              { $gt: [{ $ifNull: ["$amount", 0] }, 0] },
              { $ifNull: ["$amount", 0] },
              {
                $switch: {
                  branches: [
                    {
                      case: { $eq: ["$tier.rank", 1] },
                      then: { $ifNull: ["$plan.pricing.tier1", 0] }
                    },
                    {
                      case: { $eq: ["$tier.rank", 2] },
                      then: { $ifNull: ["$plan.pricing.tier2", { $ifNull: ["$plan.pricing.tier1", 0] }] }
                    },
                    {
                      case: { $eq: ["$tier.rank", 3] },
                      then: { $ifNull: ["$plan.pricing.tier3", { $ifNull: ["$plan.pricing.tier1", 0] }] }
                    },
                    {
                      case: { $eq: ["$tier.rank", 4] },
                      then: { $ifNull: ["$plan.pricing.tier4", { $ifNull: ["$plan.pricing.tier1", 0] }] }
                    }
                  ],
                  default: { $ifNull: ["$plan.pricing.tier1", 0] }
                }
              }
            ]
          }
        }
      }
    ];

    const subscriptionCollectionAgg = await RestaurantSubscription.aggregate([
      { $match: subscriptionMatch },
      ...subscriptionPricingLookupStages,
      {
        $group: {
          _id: null,
          totalCollection: { $sum: { $ifNull: ["$effectiveAmount", 0] } },
          count: { $sum: 1 },
          last30DaysCollection: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    { $ifNull: ["$paymentDate", "$createdAt"] },
                    last30Days
                  ]
                },
                { $ifNull: ["$effectiveAmount", 0] },
                0
              ]
            }
          }
        }
      }
    ]);

    const subscriptionCollectionStats = subscriptionCollectionAgg[0] || {
      totalCollection: 0,
      count: 0,
      last30DaysCollection: 0
    };

    // 2. Aggregated counters for orders, restaurants, and users
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const pendingRestaurantRequestsQuery = {
      ...restaurantScopeFilter,
      $and: [
        {
          isActive: false
        },
        {
          $or: [{
            rejectionReason: { $exists: false }
          }, {
            rejectionReason: null
          }]
        },
        {
          $or: [{
            "onboarding.completedSteps": { $gte: 3 }
          }, {
            $and: [{
              name: { $exists: true, $ne: null, $ne: "" }
            }, {
              cuisines: { $exists: true, $ne: null, $not: { $size: 0 } }
            }, {
              openDays: { $exists: true, $ne: null, $not: { $size: 0 } }
            }, {
              "onboarding.step2.profileImageUrl": {
                $exists: true,
                $ne: null,
                $ne: {}
              }
            }]
          }]
        }
      ]
    };

    const [orderCounts, restaurantStatsAgg, customerStatsAgg, deliveryStatsAgg] = await Promise.all([
      Order.aggregate([
        { $match: { ...orderScopeFilter, ...(startDate ? { createdAt: { $gte: startDate } } : {}) } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Restaurant.aggregate([
        {
          $facet: {
            active: [
              { $match: { ...restaurantScopeFilter, isActive: true } },
              { $count: "total" }
            ],
            total: [
              { $match: restaurantScopeFilter },
              { $count: "total" }
            ],
            pending: [
              { $match: pendingRestaurantRequestsQuery },
              { $count: "total" }
            ],
            recentActive: [
              { $match: { ...restaurantScopeFilter, isActive: true, createdAt: { $gte: last24Hours } } },
              { $count: "total" }
            ],
            activeRestaurantIds: [
              { $match: { ...restaurantScopeFilter, isActive: true } },
              { $project: { _id: 1 } }
            ]
          }
        }
      ]),
      User.aggregate([
        {
          $facet: {
            customers: [
              { $match: { $or: [{ role: "user" }, { role: { $exists: false } }, { role: null }] } },
              { $count: "total" }
            ]
          }
        }
      ]),
      Delivery.aggregate([
        {
          $facet: {
            total: [
              { $match: { ...deliveryScopeFilter, status: { $in: ["approved", "active"] } } },
              { $count: "total" }
            ],
            active: [
              { $match: { ...deliveryScopeFilter, status: { $in: ["approved", "active"] } } },
              { $count: "total" }
            ],
            pending: [
              { $match: { ...deliveryScopeFilter, status: "pending" } },
              { $count: "total" }
            ]
          }
        }
      ])
    ]);

    const orderStatusMap = orderCounts.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {});
    const restaurantStats = restaurantStatsAgg[0] || {};
    const customerStats = customerStatsAgg[0] || {};
    const deliveryStats = deliveryStatsAgg[0] || {};
    const activeRestaurants = restaurantStats.active?.[0]?.total || 0;
    const totalRestaurants = restaurantStats.total?.[0]?.total || 0;
    const pendingRestaurantRequests = restaurantStats.pending?.[0]?.total || 0;
    const recentRestaurants = restaurantStats.recentActive?.[0]?.total || 0;
    const restaurantIds = (restaurantStats.activeRestaurantIds || []).map((restaurantEntry) => restaurantEntry._id);
    const activeDeliveryPartners = deliveryStats.active?.[0]?.total || 0;
    const totalDeliveryBoys = deliveryStats.total?.[0]?.total || 0;
    const totalCustomers = customerStats.customers?.[0]?.total || 0;
    const pendingDeliveryBoyRequests = deliveryStats.pending?.[0]?.total || 0;

    // 3. Total Foods/Addons and subscription sales breakdown
    const [menuStats, allPlans, soldSubscriptionCounts, recentOrders] = await Promise.all([
      restaurantIds.length > 0
        ? Menu.aggregate([
          { $match: { isActive: true, restaurant: { $in: restaurantIds } } },
          {
            $facet: {
              foodCount: [
                { $unwind: "$sections" },
                {
                  $project: {
                    allItems: {
                      $concatArrays: [
                        { $ifNull: ["$sections.items", []] },
                        {
                          $reduce: {
                            input: { $ifNull: ["$sections.subsections", []] },
                            initialValue: [],
                            in: { $concatArrays: ["$$value", { $ifNull: ["$$this.items", []] }] }
                          }
                        }
                      ]
                    }
                  }
                },
                { $unwind: "$allItems" },
                { $match: { "allItems.id": { $exists: true }, "allItems.name": { $exists: true }, "allItems.approvalStatus": { $ne: "rejected" } } },
                { $count: "total" }
              ],
              addonCount: [
                { $unwind: "$addons" },
                { $match: { "addons.id": { $exists: true }, "addons.name": { $exists: true }, "addons.approvalStatus": { $ne: "rejected" } } },
                { $count: "total" }
              ]
            }
          }
        ])
        : [{ foodCount: [], addonCount: [] }],
      SubscriptionPlan.find({ isActive: true }).select("name").lean(),
      RestaurantSubscription.aggregate([
        {
          $match: {
            paymentStatus: "completed",
            ...(tierId && tierId !== "all" ? { restaurantId: { $in: scopedRestaurantObjectIds } } : {}),
            ...(startDate
              ? {
                  $or: [
                    { paymentDate: { $gte: startDate } },
                    {
                      paymentDate: { $exists: false },
                      createdAt: { $gte: startDate }
                    }
                  ]
                }
              : {})
          }
        },
        {
          $group: {
            _id: "$planId",
            count: { $sum: 1 }
          }
        }
      ]),
      Order.countDocuments({ ...orderScopeFilter, createdAt: { $gte: last24Hours } })
    ]);

    const totalFoods = menuStats[0]?.foodCount?.[0]?.total || 0;
    const totalAddons = menuStats[0]?.addonCount?.[0]?.total || 0;
    const subscriptionCountsMap = new Map(
      soldSubscriptionCounts.map((entry) => [entry._id?.toString(), entry.count || 0])
    );
    const subscriptionStats = allPlans.map((plan) => ({
      _id: plan._id,
      name: plan.name,
      count: subscriptionCountsMap.get(plan._id.toString()) || 0
    }));

    // 4. 12-Month Data (A single aggregation JOINING Order and OrderSettlement)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyStats = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          deliveredAt: { $gte: twelveMonthsAgo },
          ...orderScopeFilter
        }
      },
      {
        $lookup: {
          from: "ordersettlements",
          let: {
            orderId: "$_id"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    {
                      $toString: {
                        $ifNull: ["$orderId", ""]
                      }
                    },
                    {
                      $toString: "$$orderId"
                    }
                  ]
                }
              }
            }
          ],
          as: "settlement"
        }
      },
      { $unwind: { path: "$settlement", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            year: { $year: "$deliveredAt" },
            month: { $month: "$deliveredAt" }
          },
          revenue: { $sum: "$pricing.total" },
          commission: { $sum: { $ifNull: ["$settlement.adminEarning.commission", 0] } },
          orders: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const subscriptionMonthlyStats = await RestaurantSubscription.aggregate([
      {
        $match: {
          paymentStatus: "completed",
          ...(tierId && tierId !== "all" ? { restaurantId: { $in: scopedRestaurantObjectIds } } : {}),
          $or: [
            { paymentDate: { $gte: twelveMonthsAgo } },
            {
              paymentDate: { $exists: false },
              createdAt: { $gte: twelveMonthsAgo }
            }
          ]
        }
      },
      ...subscriptionPricingLookupStages,
      {
        $group: {
          _id: {
            year: {
              $year: { $ifNull: ["$paymentDate", "$createdAt"] }
            },
            month: {
              $month: { $ifNull: ["$paymentDate", "$createdAt"] }
            }
          },
          collection: { $sum: { $ifNull: ["$effectiveAmount", 0] } }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const match = monthlyStats.find(s => s._id.year === year && s._id.month === month);
      const subscriptionMatch = subscriptionMonthlyStats.find(s => s._id.year === year && s._id.month === month);

      monthlyData.push({
        month: monthNames[d.getMonth()],
        revenue: match ? Math.round(match.revenue * 100) / 100 : 0,
        commission: match ? Math.round(match.commission * 100) / 100 : 0,
        subscriptionCollection: subscriptionMatch ? Math.round(subscriptionMatch.collection * 100) / 100 : 0,
        orders: match ? match.orders : 0
      });
    }

    return successResponse(res, 200, "Dashboard stats retrieved successfully", {
      revenue: {
        total: Math.round(stats.totalRevenue * 100) / 100,
        last30Days: Math.round(stats.last30DaysRevenue * 100) / 100,
        currency: "INR"
      },
      commission: {
        total: Math.round(stats.totalCommission * 100) / 100,
        last30Days: Math.round(stats.last30DaysCommission * 100) / 100,
        currency: "INR"
      },
      subscriptionCollection: {
        total: Math.round(subscriptionCollectionStats.totalCollection * 100) / 100,
        last30Days: Math.round(subscriptionCollectionStats.last30DaysCollection * 100) / 100,
        count: subscriptionCollectionStats.count || 0,
        currency: "INR"
      },
      platformFee: {
        total: Math.round(stats.totalPlatformFee * 100) / 100,
        last30Days: Math.round(stats.last30DaysPlatformFee * 100) / 100,
        currency: "INR"
      },
      deliveryFee: {
        total: Math.round(stats.totalDeliveryFee * 100) / 100,
        last30Days: Math.round(stats.last30DaysDeliveryFee * 100) / 100,
        currency: "INR"
      },
      gst: {
        total: Math.round(stats.totalGST * 100) / 100,
        last30Days: Math.round(stats.last30DaysGST * 100) / 100,
        currency: "INR"
      },
      recommendedItemFee: {
        total: Math.round(stats.totalRecommendedFee * 100) / 100,
        last30Days: Math.round(stats.last30DaysRecommendedFee * 100) / 100,
        currency: "INR"
      },
      totalAdminEarnings: {
        total: Math.round((stats.totalCommission + stats.totalPlatformFee + stats.totalDeliveryFee + stats.totalGST + stats.totalRecommendedFee) * 100) / 100,
        last30Days: Math.round((stats.last30DaysCommission + stats.last30DaysPlatformFee + stats.last30DaysDeliveryFee + stats.last30DaysGST + stats.last30DaysRecommendedFee) * 100) / 100,
        currency: "INR"
      },
      orders: {
        total: stats.count,
        byStatus: {
          pending: orderStatusMap.pending || 0,
          confirmed: orderStatusMap.confirmed || 0,
          preparing: orderStatusMap.preparing || 0,
          ready: orderStatusMap.ready || 0,
          out_for_delivery: orderStatusMap.out_for_delivery || 0,
          delivered: orderStatusMap.delivered || 0,
          cancelled: orderStatusMap.cancelled || 0
        }
      },
      partners: {
        total: activeRestaurants + activeDeliveryPartners,
        restaurants: activeRestaurants,
        delivery: activeDeliveryPartners
      },
      recentActivity: {
        orders: recentOrders,
        restaurants: recentRestaurants,
        period: "last24Hours"
      },
      monthlyData: monthlyData,
      restaurants: {
        total: totalRestaurants,
        active: activeRestaurants,
        pendingRequests: pendingRestaurantRequests
      },
      deliveryBoys: {
        total: totalDeliveryBoys,
        active: activeDeliveryPartners,
        pendingRequests: pendingDeliveryBoyRequests
      },
      foods: { total: totalFoods },
      addons: { total: totalAddons },
      customers: { total: totalCustomers },
      orderStats: {
        pending: orderStatusMap.pending || 0,
        completed: orderStatusMap.delivered || 0
      },
      subscriptionStats: subscriptionStats
    });
  } catch (error) {
    logger.error(`Error fetching dashboard stats: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch dashboard statistics");
  }
});

/**
 * Get All Admins
 * GET /api/admin/admins
 */
export const getAdmins = asyncHandler(async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      search
    } = req.query;
    const query = {};
    if (search) {
      query.$or = [{
        name: {
          $regex: search,
          $options: "i"
        }
      }, {
        email: {
          $regex: search,
          $options: "i"
        }
      }];
    }
    // Get admins with projection
    const admins = await Admin.find(query)
      .select("name email phone isActive createdAt")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
    const total = await Admin.countDocuments(query);
    return successResponse(res, 200, "Admins retrieved successfully", {
      admins,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error(`Error fetching admins: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch admins");
  }
});

/**
 * Get Admin by ID
 * GET /api/admin/admins/:id
 */
export const getAdminById = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const admin = await Admin.findById(id).select("-password").lean();
    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }
    return successResponse(res, 200, "Admin retrieved successfully", {
      admin
    });
  } catch (error) {
    logger.error(`Error fetching admin: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch admin");
  }
});

/**
 * Create Admin (only by existing admin)
 * POST /api/admin/admins
 */
export const createAdmin = asyncHandler(async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone
    } = req.body;

    // Validation
    if (!name || !email || !password) {
      return errorResponse(res, 400, "Name, email, and password are required");
    }
    if (password.length < 6) {
      return errorResponse(res, 400, "Password must be at least 6 characters long");
    }

    // Check if admin already exists with this email
    const existingAdmin = await Admin.findOne({
      email: email.toLowerCase()
    });
    if (existingAdmin) {
      return errorResponse(res, 400, "Admin already exists with this email");
    }

    // Create new admin
    const adminData = {
      name,
      email: email.toLowerCase(),
      password,
      isActive: true,
      phoneVerified: false
    };
    if (phone) {
      adminData.phone = phone;
    }
    const admin = await Admin.create(adminData);

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    return successResponse(res, 201, "Admin created successfully", {
      admin: adminResponse
    });
  } catch (error) {
    logger.error(`Error creating admin: ${error.message}`);
    if (error.code === 11000) {
      return errorResponse(res, 400, "Admin with this email already exists");
    }
    return errorResponse(res, 500, "Failed to create admin");
  }
});

/**
 * Update Admin
 * PUT /api/admin/admins/:id
 */
export const updateAdmin = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      name,
      email,
      phone,
      isActive
    } = req.body;
    const admin = await Admin.findById(id);
    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    // Prevent updating own account's isActive status
    if (id === req.user._id.toString() && isActive === false) {
      return errorResponse(res, 400, "You cannot deactivate your own account");
    }

    // Update fields
    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase();
    if (phone !== undefined) admin.phone = phone;
    if (isActive !== undefined) admin.isActive = isActive;
    await admin.save();
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    return successResponse(res, 200, "Admin updated successfully", {
      admin: adminResponse
    });
  } catch (error) {
    logger.error(`Error updating admin: ${error.message}`);
    if (error.code === 11000) {
      return errorResponse(res, 400, "Admin with this email already exists");
    }
    return errorResponse(res, 500, "Failed to update admin");
  }
});

/**
 * Delete Admin
 * DELETE /api/admin/admins/:id
 */
export const deleteAdmin = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;

    // Prevent deleting own account
    if (id === req.user._id.toString()) {
      return errorResponse(res, 400, "You cannot delete your own account");
    }
    const admin = await Admin.findById(id);
    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }
    await Admin.deleteOne({
      _id: id
    });
    return successResponse(res, 200, "Admin deleted successfully");
  } catch (error) {
    logger.error(`Error deleting admin: ${error.message}`);
    return errorResponse(res, 500, "Failed to delete admin");
  }
});

/**
 * Get Current Admin Profile
 * GET /api/admin/profile
 */
export const getAdminProfile = asyncHandler(async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id).select("-password").lean();
    if (!admin) {
      return errorResponse(res, 404, "Admin profile not found");
    }
    return successResponse(res, 200, "Admin profile retrieved successfully", {
      admin
    });
  } catch (error) {
    logger.error(`Error fetching admin profile: ${error.message}`);
    return errorResponse(res, 500, "Failed to fetch admin profile");
  }
});

/**
 * Update Current Admin Profile
 * PUT /api/admin/profile
 */
export const updateAdminProfile = asyncHandler(async (req, res) => {
  try {
    const {
      name,
      phone,
      profileImage
    } = req.body;
    const admin = await Admin.findById(req.user._id);
    if (!admin) {
      return errorResponse(res, 404, "Admin profile not found");
    }

    // Update fields (email cannot be changed via profile update)
    if (name !== undefined && name !== null) {
      admin.name = name.trim();
    }
    if (phone !== undefined) {
      // Allow empty string to clear phone number
      admin.phone = phone ? phone.trim() : null;
    }
    if (profileImage !== undefined) {
      // Allow empty string to clear profile image
      admin.profileImage = profileImage || null;
    }

    // Save to database
    await admin.save();

    // Remove password from response
    const adminResponse = admin.toObject();
    delete adminResponse.password;
    return successResponse(res, 200, "Profile updated successfully", {
      admin: adminResponse
    });
  } catch (error) {
    logger.error(`Error updating admin profile: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to update profile");
  }
});

export const getAdminPreferences = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id).select("preferences").lean();
  if (!admin) {
    return errorResponse(res, 404, "Admin profile not found");
  }

  return successResponse(res, 200, "Preferences retrieved successfully", {
    preferences: {
      language: admin.preferences?.language || "en"
    }
  });
});

export const updateAdminPreferences = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id);
  if (!admin) {
    return errorResponse(res, 404, "Admin profile not found");
  }

  admin.preferences = admin.preferences || {};
  admin.preferences.language = normalizeLocale(req.body?.language);
  await admin.save();

  return successResponse(res, 200, "Preferences updated successfully", {
    preferences: {
      language: admin.preferences.language
    }
  });
});

/**
 * Change Admin Password
 * PUT /api/admin/settings/change-password
 */
export const changeAdminPassword = asyncHandler(async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword
    } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return errorResponse(res, 400, "Current password and new password are required");
    }
    if (newPassword.length < 6) {
      return errorResponse(res, 400, "New password must be at least 6 characters long");
    }

    // Get admin with password field
    const admin = await Admin.findById(req.user._id).select("+password");
    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    // Verify current password
    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return errorResponse(res, 401, "Current password is incorrect");
    }

    // Check if new password is same as current
    const isSamePassword = await admin.comparePassword(newPassword);
    if (isSamePassword) {
      return errorResponse(res, 400, "New password must be different from current password");
    }

    // Update password (pre-save hook will hash it)
    admin.password = newPassword;
    await admin.save();
    return successResponse(res, 200, "Password changed successfully");
  } catch (error) {
    logger.error(`Error changing admin password: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to change password");
  }
});

/**
 * Get All Users (Customers) with Order Statistics
 * GET /api/admin/users
 */
export const getUsers = asyncHandler(async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      search,
      status,
      sortBy,
      orderDate,
      joiningDate
    } = req.query;
    const User = (await import("../../auth/models/User.js")).default;

    // Build query
    const query = {
      role: "user"
    }; // Only get users, not restaurants/delivery/admins

    // Search filter
    if (search) {
      query.$or = [{
        name: {
          $regex: search,
          $options: "i"
        }
      }, {
        email: {
          $regex: search,
          $options: "i"
        }
      }, {
        phone: {
          $regex: search,
          $options: "i"
        }
      }];
    }

    // Status filter
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    // Joining date filter
    if (joiningDate) {
      const startDate = new Date(joiningDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(joiningDate);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    }

    // Get users
    // Get users with projection
    const users = await User.find(query)
      .select("name email phone role isActive createdAt preferences profileImage")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    // Get user IDs
    const userIds = users.map(user => user._id);

    // Get order statistics for each user
    const orderStats = await Order.aggregate([{
      $match: {
        userId: {
          $in: userIds
        }
      }
    }, {
      $group: {
        _id: "$userId",
        totalOrders: {
          $sum: 1
        },
        totalAmount: {
          $sum: "$pricing.total"
        }
      }
    }]);

    // Create a map of userId -> stats
    const statsMap = {};
    orderStats.forEach(stat => {
      statsMap[stat._id.toString()] = {
        totalOrder: stat.totalOrders || 0,
        totalOrderAmount: stat.totalAmount || 0
      };
    });

    // Format users with order statistics
    const formattedUsers = users.map((user, index) => {
      const stats = statsMap[user._id.toString()] || {
        totalOrder: 0,
        totalOrderAmount: 0
      };

      // Format joining date
      const joiningDate = new Date(user.createdAt);
      const formattedDate = joiningDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      return {
        sl: parseInt(offset) + index + 1,
        id: user._id.toString(),
        name: user.name || "N/A",
        email: user.email || "N/A",
        phone: user.phone || "N/A",
        totalOrder: stats.totalOrder,
        totalOrderAmount: stats.totalOrderAmount,
        joiningDate: formattedDate,
        status: user.isActive !== false,
        // Default to true if not set
        createdAt: user.createdAt
      };
    });

    // Apply sorting
    if (sortBy) {
      if (sortBy === "name-asc") {
        formattedUsers.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortBy === "name-desc") {
        formattedUsers.sort((a, b) => b.name.localeCompare(a.name));
      } else if (sortBy === "orders-asc") {
        formattedUsers.sort((a, b) => a.totalOrder - b.totalOrder);
      } else if (sortBy === "orders-desc") {
        formattedUsers.sort((a, b) => b.totalOrder - a.totalOrder);
      }
    }

    // Order date filter (filter by order date after aggregation)
    let filteredUsers = formattedUsers;
    if (orderDate) {
      // This would require additional query to filter by order date
      // For now, we'll skip this as it's complex and may require different approach
    }
    const total = await User.countDocuments(query);
    return successResponse(res, 200, "Users retrieved successfully", {
      users: filteredUsers,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    logger.error(`Error fetching users: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to fetch users");
  }
});

/**
 * Get User by ID with Full Details
 * GET /api/admin/users/:id
 */
export const getUserById = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const User = (await import("../../auth/models/User.js")).default;
    const user = await User.findById(id).select("-password -__v").lean();
    if (!user) {
      return errorResponse(res, 404, "User not found");
    }

    // Get order statistics
    const orderStats = await Order.aggregate([{
      $match: {
        userId: user._id
      }
    }, {
      $group: {
        _id: null,
        totalOrders: {
          $sum: 1
        },
        totalAmount: {
          $sum: "$pricing.total"
        },
        orders: {
          $push: {
            orderId: "$orderId",
            status: "$status",
            total: "$pricing.total",
            createdAt: "$createdAt",
            restaurantName: "$restaurantName"
          }
        }
      }
    }]);
    const stats = orderStats[0] || {
      totalOrders: 0,
      totalAmount: 0,
      orders: []
    };

    // Format joining date
    const joiningDate = new Date(user.createdAt);
    const formattedDate = joiningDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    // Load wallet from UserWallet as source of truth
    const { default: UserWallet } = await import("../../user/models/UserWallet.js");
    const walletDoc = await UserWallet.findOne({ userId: user._id }).lean();
    const walletData = walletDoc
      ? {
        balance: walletDoc.balance || 0,
        currency: walletDoc.currency || "INR",
      }
      : {
        balance: 0,
        currency: "INR",
      };

    return successResponse(res, 200, "User retrieved successfully", {
      user: {
        id: user._id.toString(),
        name: user.name || "N/A",
        email: user.email || "N/A",
        phone: user.phone || "N/A",
        phoneVerified: user.phoneVerified || false,
        profileImage: user.profileImage || null,
        role: user.role,
        signupMethod: user.signupMethod,
        isActive: user.isActive !== false,
        addresses: user.addresses || [],
        preferences: user.preferences || {},
        wallet: walletData,
        dateOfBirth: user.dateOfBirth || null,
        anniversary: user.anniversary || null,
        gender: user.gender || null,
        joiningDate: formattedDate,
        createdAt: user.createdAt,
        totalOrders: stats.totalOrders,
        totalOrderAmount: stats.totalAmount,
        orders: stats.orders.slice(0, 10) // Last 10 orders
      }
    });
  } catch (error) {
    logger.error(`Error fetching user: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to fetch user");
  }
});

/**
 * Update User Status (Active/Inactive)
 * PUT /api/admin/users/:id/status
 */
export const updateUserStatus = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      isActive
    } = req.body;
    const User = (await import("../../auth/models/User.js")).default;
    if (typeof isActive !== "boolean") {
      return errorResponse(res, 400, "isActive must be a boolean value");
    }
    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 404, "User not found");
    }
    user.isActive = isActive;
    await user.save();
    return successResponse(res, 200, "User status updated successfully", {
      user: {
        id: user._id.toString(),
        name: user.name,
        isActive: user.isActive
      }
    });
  } catch (error) {
    logger.error(`Error updating user status: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to update user status");
  }
});

/**
 * Get All Restaurants
 * GET /api/admin/restaurants
 * Query params: page, limit, search, status, cuisine, zone
 */
export const getRestaurants = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      cuisine,
      zone
    } = req.query;

    // Build query
    const query = {};

    // Status filter - Default to active only (approved restaurants)
    // Only show inactive if explicitly requested via status filter
    // IMPORTANT: Restaurants should only appear in main list AFTER admin approval
    // Inactive restaurants (pending approval) should only appear in "New Joining Request" section
    if (status === "inactive") {
      query.isActive = false;
    } else {
      // Default: Show only active (approved) restaurants
      // This ensures that restaurants only appear in main list after admin approval
      query.isActive = true;
    }
    // Search filter
    if (search) {
      query.$or = [{
        name: {
          $regex: search,
          $options: "i"
        }
      }, {
        ownerName: {
          $regex: search,
          $options: "i"
        }
      }, {
        ownerPhone: {
          $regex: search,
          $options: "i"
        }
      }, {
        phone: {
          $regex: search,
          $options: "i"
        }
      }, {
        email: {
          $regex: search,
          $options: "i"
        }
      }];
    }

    // Cuisine filter
    if (cuisine) {
      query.cuisines = {
        $in: [new RegExp(cuisine, "i")]
      };
    }

    // Zone filter
    if (zone && zone !== "All over the World") {
      query.$or = [{
        "location.area": {
          $regex: zone,
          $options: "i"
        }
      }, {
        "location.city": {
          $regex: zone,
          $options: "i"
        }
      }];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch restaurants
    // Fetch restaurants with projection (including populated zone/tier info for UI)
    const restaurants = await Restaurant.find(query)
      .select("name ownerName ownerPhone email phone isActive location cuisines createdAt profileImage businessModel approvedAt onboarding.completedSteps zoneId deliveryRange")
      .populate({
        path: "zoneId",
        select: "name tierId",
        populate: {
          path: "tierId",
          select: "name",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Restaurant.countDocuments(query);
    return successResponse(res, 200, "Restaurants retrieved successfully", {
      restaurants: restaurants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching restaurants: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to fetch restaurants");
  }
});

/**
 * Get Restaurant By ID (Admin)
 * GET /api/admin/restaurants/:id
 */
export const getRestaurantById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, 400, "Invalid restaurant ID");
    }

    const restaurant = await Restaurant.findById(id)
      .populate({
        path: "zoneId",
        select: "name tierId",
        populate: {
          path: "tierId",
          select: "name rank"
        }
      })
      .populate("subscription.planId", "name durationInDays features pricing")
      .lean();
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    const now = new Date();
    const [activePurchasedSubscription, latestPurchasedSubscription] = await Promise.all([
      RestaurantSubscription.findOne({
        restaurantId: restaurant._id,
        status: "active",
        paymentStatus: "completed",
        endDate: { $gte: now }
      })
        .populate("planId", "name durationInDays features pricing")
        .sort({ endDate: -1, paymentDate: -1, createdAt: -1 })
        .lean(),
      RestaurantSubscription.findOne({
        restaurantId: restaurant._id,
        paymentStatus: "completed"
      })
        .populate("planId", "name durationInDays features pricing")
        .sort({ paymentDate: -1, createdAt: -1 })
        .lean()
    ]);

    const purchasedSubscription = activePurchasedSubscription || latestPurchasedSubscription;
    if (purchasedSubscription) {
      const existingSubscription = restaurant.subscription || {};
      const planDoc = purchasedSubscription.planId && typeof purchasedSubscription.planId === "object"
        ? purchasedSubscription.planId
        : null;

      restaurant.subscription = {
        ...existingSubscription,
        planId: planDoc?._id || existingSubscription.planId || null,
        planName: planDoc?.name || existingSubscription?.planId?.name || null,
        startDate: purchasedSubscription.startDate || existingSubscription.startDate || null,
        endDate: purchasedSubscription.endDate || existingSubscription.endDate || null,
        status: purchasedSubscription.status || existingSubscription.status || "inactive",
        autoRenew: existingSubscription.autoRenew ?? true,
        paymentStatus: purchasedSubscription.paymentStatus || existingSubscription.paymentStatus || "pending",
        paymentDate: purchasedSubscription.paymentDate || existingSubscription.paymentDate || null,
        amount: purchasedSubscription.amount ?? existingSubscription.amount ?? 0,
        features: planDoc?.features || existingSubscription.features || [],
        durationInDays: planDoc?.durationInDays || existingSubscription.durationInDays || null,
      };
    }

    return successResponse(res, 200, "Restaurant retrieved successfully", {
      restaurant,
    });
  } catch (error) {
    logger.error(`Error fetching restaurant by ID: ${error.message}`, {
      error: error.stack,
    });
    return errorResponse(res, 500, "Failed to fetch restaurant");
  }
});

/**
 * Update Restaurant Status (Active/Inactive/Ban)
 * PUT /api/admin/restaurants/:id/status
 */
export const updateRestaurantStatus = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      isActive
    } = req.body;
    if (typeof isActive !== "boolean") {
      return errorResponse(res, 400, "isActive must be a boolean value");
    }
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }
    restaurant.isActive = isActive;
    await restaurant.save();
    return successResponse(res, 200, "Restaurant status updated successfully", {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        isActive: restaurant.isActive
      }
    });
  } catch (error) {
    logger.error(`Error updating restaurant status: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to update restaurant status");
  }
});

/**
 * Get Restaurant Join Requests
 * GET /api/admin/restaurants/requests
 * Query params: status (pending, rejected), page, limit, search
 */
export const getRestaurantJoinRequests = asyncHandler(async (req, res) => {
  try {
    const {
      status = "pending",
      page = 1,
      limit = 50,
      search
    } = req.query;

    // Build query
    const query = {};

    // Status filter
    // Pending = restaurants with onboarding completed (step 3) but not yet active
    // Rejected = restaurants that have rejectionReason
    if (status === "pending") {
      // Build conditions array for $and - ensures all conditions are met
      // Check for rejectionReason: either doesn't exist OR is null
      const conditions = [{
        isActive: false
      }, {
        $or: [{
          rejectionReason: {
            $exists: false
          }
        }, {
          rejectionReason: null
        }]
      }];

      // Only show restaurants that have completed onboarding (step 3)
      // Check if onboarding.completedSteps >= 3, OR if restaurant has all required data filled (step1-3)
      // This handles both cases: restaurants with proper tracking AND restaurants that completed onboarding before tracking was added
      const completionCheck = {
        $or: [{
          "onboarding.completedSteps": { $gte: 3 }
        },
        // Fallback: If completedSteps is not 4 (or doesn't exist), check if restaurant has all main fields filled
        // This matches restaurants that have completed onboarding even if completedSteps field wasn't set to 4
        {
          $and: [{
            name: {
              $exists: true,
              $ne: null,
              $ne: ""
            }
          },
          // Has restaurant name
          {
            cuisines: {
              $exists: true,
              $ne: null,
              $not: {
                $size: 0
              }
            }
          },
          // Has cuisines (array with items)
          {
            openDays: {
              $exists: true,
              $ne: null,
              $not: {
                $size: 0
              }
            }
          },
          // Has open days (array with items)
          {
            "onboarding.step2.profileImageUrl": {
              $exists: true,
              $ne: null,
              $ne: {}
            }
          } // Has profile image from step 2
          ]
        }]
      };
      conditions.push(completionCheck);
      query.$and = conditions;
    } else if (status === "rejected") {
      query["rejectionReason"] = {
        $exists: true,
        $ne: null
      };
      // For rejected, also check if onboarding is complete
      query.$or = [{
        "onboarding.completedSteps": { $gte: 3 }
      }, {
        $and: [{
          name: {
            $exists: true,
            $ne: null,
            $ne: ""
          }
        }]
      }];
    }

    // Search filter - combine with $and if search is provided
    if (search && search.trim()) {
      const searchConditions = {
        $or: [{
          name: {
            $regex: search.trim(),
            $options: "i"
          }
        }, {
          ownerName: {
            $regex: search.trim(),
            $options: "i"
          }
        }, {
          ownerPhone: {
            $regex: search.trim(),
            $options: "i"
          }
        }, {
          phone: {
            $regex: search.trim(),
            $options: "i"
          }
        }, {
          email: {
            $regex: search.trim(),
            $options: "i"
          }
        }]
      };

      // If query already has $and, add search to it; otherwise create new $and
      if (query.$and) {
        query.$and.push(searchConditions);
      } else {
        // Convert existing query conditions to $and format
        const baseConditions = {
          ...query
        };
        query = {
          $and: [baseConditions, searchConditions]
        };
      }
    }
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch restaurants
    // Fetch restaurants with projection
    const restaurants = await Restaurant.find(query)
      .select("name ownerName ownerPhone email phone isActive location cuisines createdAt profileImage businessModel onboarding.completedSteps onboarding.step2.profileImageUrl rejectionReason")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Debug: Log found restaurants with detailed info

    // Get total count
    const total = await Restaurant.countDocuments(query);
    // Also log a sample of ALL inactive restaurants (for debugging)
    if (status === "pending" && restaurants.length === 0) {
      const allInactive = await Restaurant.find({
        isActive: false,
        $or: [{
          rejectionReason: {
            $exists: false
          }
        }, {
          rejectionReason: null
        }]
      }).select("name isActive onboarding.completedSteps cuisines openDays estimatedDeliveryTime featuredDish").limit(10).lean();
      const totalInactive = await Restaurant.countDocuments({
        isActive: false,
        $or: [{
          rejectionReason: {
            $exists: false
          }
        }, {
          rejectionReason: null
        }]
      });
    }

    // Format response to match frontend expectations
    const formattedRequests = restaurants.map((restaurant, index) => {
      // Get zone from location
      let zone = "All over the World";
      if (restaurant.location?.area) {
        zone = restaurant.location.area;
      } else if (restaurant.location?.city) {
        zone = restaurant.location.city;
      }

      // Get business model (could be from subscription or commission - defaulting for now)
      const businessModel = restaurant.businessModel || "Commission Base";

      // Get status
      const requestStatus = restaurant.rejectionReason ? "Rejected" : "Pending";
      return {
        _id: restaurant._id.toString(),
        sl: skip + index + 1,
        restaurantName: restaurant.name || "N/A",
        restaurantImage: restaurant.profileImage?.url || restaurant.onboarding?.step2?.profileImageUrl?.url || "https://via.placeholder.com/40",
        ownerName: restaurant.ownerName || "N/A",
        ownerPhone: restaurant.ownerPhone || restaurant.phone || "N/A",
        zone: zone,
        businessModel: businessModel,
        status: requestStatus,
        rejectionReason: restaurant.rejectionReason || null,
        createdAt: restaurant.createdAt
      };
    });
    return successResponse(res, 200, "Restaurant join requests retrieved successfully", {
      requests: formattedRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching restaurant join requests: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to fetch restaurant join requests");
  }
});

/**
 * Approve Restaurant Join Request
 * POST /api/admin/restaurants/:id/approve
 */
export const approveRestaurant = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const adminId = req.user._id;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }
    if (restaurant.isActive) {
      return errorResponse(res, 400, "Restaurant is already approved");
    }
    if (restaurant.rejectionReason) {
      return errorResponse(res, 400, "Cannot approve a rejected restaurant. Please remove rejection reason first.");
    }

    // Activate restaurant
    restaurant.isActive = true;
    restaurant.approvedAt = new Date();
    restaurant.approvedBy = adminId;
    restaurant.rejectionReason = undefined; // Clear any previous rejection

    await restaurant.save();
    try {
      await applyZoneTierToRestaurantById(restaurant._id);
    } catch (zoneErr) {
      logger.warn(`Zone/tier assignment on approve failed: ${zoneErr.message}`);
    }
    return successResponse(res, 200, "Restaurant approved successfully", {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        isActive: restaurant.isActive,
        approvedAt: restaurant.approvedAt
      }
    });
  } catch (error) {
    logger.error(`Error approving restaurant: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to approve restaurant");
  }
});

/**
 * Reject Restaurant Join Request
 * POST /api/admin/restaurants/:id/reject
 */
export const rejectRestaurant = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      reason
    } = req.body;
    const adminId = req.user._id;

    // Validate reason is provided
    if (!reason || !reason.trim()) {
      return errorResponse(res, 400, "Rejection reason is required");
    }
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    // Set rejection details (allow updating if already rejected)
    restaurant.rejectionReason = reason.trim();
    restaurant.rejectedAt = new Date();
    restaurant.rejectedBy = adminId;
    restaurant.isActive = false; // Ensure it's inactive

    await restaurant.save();
    return successResponse(res, 200, "Restaurant rejected successfully", {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        rejectionReason: restaurant.rejectionReason
      }
    });
  } catch (error) {
    logger.error(`Error rejecting restaurant: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to reject restaurant");
  }
});

/**
 * Reverify Restaurant (Resubmit for approval)
 * POST /api/admin/restaurants/:id/reverify
 */
export const reverifyRestaurant = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const adminId = req.user._id;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    // Check if restaurant was rejected
    if (!restaurant.rejectionReason) {
      return errorResponse(res, 400, "Restaurant is not rejected. Only rejected restaurants can be reverified.");
    }

    // Clear rejection details and mark as pending again
    restaurant.rejectionReason = null;
    restaurant.rejectedAt = undefined;
    restaurant.rejectedBy = undefined;
    restaurant.isActive = false; // Keep inactive until approved

    await restaurant.save();
    return successResponse(res, 200, "Restaurant reverified successfully. Waiting for admin approval.", {
      restaurant: {
        id: restaurant._id.toString(),
        name: restaurant.name,
        isActive: restaurant.isActive,
        rejectionReason: null
      }
    });
  } catch (error) {
    logger.error(`Error reverifying restaurant: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to reverify restaurant");
  }
});

/**
 * Create Restaurant by Admin
 * POST /api/admin/restaurants
 */
export const createRestaurant = asyncHandler(async (req, res) => {
  try {
    const adminId = req.user._id;
    const {
      // Step 1: Basic Info
      restaurantName,
      ownerName,
      ownerEmail,
      ownerPhone,
      primaryContactNumber,
      location,
      // Step 2: Images & Operational
      menuImages,
      // Array of image URLs or base64
      profileImage,
      // Image URL or base64
      cuisines,
      openingTime,
      closingTime,
      openDays,
      // Step 3: Documents
      panNumber,
      nameOnPan,
      panImage,
      // Image URL or base64
      gstRegistered,
      gstNumber,
      gstLegalName,
      gstAddress,
      gstImage,
      // Image URL or base64
      fssaiNumber,
      fssaiExpiry,
      fssaiImage,
      // Image URL or base64
      accountNumber,
      ifscCode,
      accountHolderName,
      accountType,
      // Step 4: Display Info
      estimatedDeliveryTime,
      featuredDish,
      featuredPrice,
      offer,
      // Authentication
      email,
      phone,
      password,
      signupMethod = "email"
    } = req.body;

    // Validation
    if (!restaurantName || !ownerName || !ownerEmail) {
      return errorResponse(res, 400, "Restaurant name, owner name, and owner email are required");
    }
    if (!email && !phone) {
      return errorResponse(res, 400, "Either email or phone is required");
    }

    // Normalize phone number if provided
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : null;
    if (phone && !normalizedPhone) {
      return errorResponse(res, 400, "Invalid phone number format");
    }

    // Regex validations
    const nameRegex = /^[a-zA-Z\s\-]+$/;
    const phoneFormatRegex = /^(\+91[\-\s]?)?[6-9]\d{9}$/;

    if (!nameRegex.test(restaurantName)) {
      return errorResponse(res, 400, "Restaurant name can only contain letters, spaces, and hyphens");
    }
    if (!nameRegex.test(ownerName)) {
      return errorResponse(res, 400, "Owner name can only contain letters, spaces, and hyphens");
    }

    if (phone && !phoneFormatRegex.test(phone)) {
      return errorResponse(res, 400, "Invalid primary phone number format");
    }

    if (ownerPhone && !phoneFormatRegex.test(ownerPhone)) {
      return errorResponse(res, 400, "Invalid owner phone number format");
    }

    if (primaryContactNumber && !phoneFormatRegex.test(primaryContactNumber)) {
      return errorResponse(res, 400, "Invalid restaurant contact number format");
    }

    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const fssaiRegex = /^\d{14}$/;
    const accountRegex = /^\d{9,18}$/;
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

    if (panNumber && !panRegex.test(panNumber.toUpperCase())) {
      return errorResponse(res, 400, "Invalid PAN number format");
    }

    if (gstNumber && !gstRegex.test(gstNumber.toUpperCase())) {
      return errorResponse(res, 400, "Invalid GST number format");
    }

    if (fssaiNumber && !fssaiRegex.test(fssaiNumber)) {
      return errorResponse(res, 400, "Invalid FSSAI number format (must be 14 digits)");
    }

    if (accountNumber && !accountRegex.test(accountNumber)) {
      return errorResponse(res, 400, "Invalid account number format (9-18 digits)");
    }

    if (ifscCode && !ifscRegex.test(ifscCode.toUpperCase())) {
      return errorResponse(res, 400, "Invalid IFSC code format");
    }

    // Generate random password if email is provided but password is not
    let finalPassword = password;
    if (email && !password) {
      // Generate a random 12-character password
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
      finalPassword = Array.from({
        length: 12
      }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }

    // Check if restaurant already exists with same email or phone
    const existingRestaurant = await Restaurant.findOne({
      $or: [...(email ? [{
        email: email.toLowerCase().trim()
      }] : []), ...(normalizedPhone ? [{
        phone: normalizedPhone
      }] : [])]
    });
    if (existingRestaurant) {
      if (email && existingRestaurant.email === email.toLowerCase().trim()) {
        return errorResponse(res, 400, "Restaurant with this email already exists");
      }
      if (normalizedPhone && existingRestaurant.phone === normalizedPhone) {
        return errorResponse(res, 400, "Restaurant with this phone number already exists. Please use a different phone number.");
      }
    }

    // Initialize Cloudinary
    await initializeCloudinary();

    // Upload images if provided as base64 or files
    let profileImageData = null;
    if (profileImage) {
      if (typeof profileImage === "string" && profileImage.startsWith("data:")) {
        // Base64 image - convert to buffer and upload
        const base64Data = profileImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/restaurant/profile",
          resource_type: "image"
        });
        profileImageData = {
          url: result.secure_url,
          publicId: result.public_id
        };
      } else if (typeof profileImage === "string" && profileImage.startsWith("http")) {
        // Already a URL
        profileImageData = {
          url: profileImage
        };
      } else if (profileImage.url) {
        // Already an object with url
        profileImageData = profileImage;
      }
    }
    let menuImagesData = [];
    if (menuImages && Array.isArray(menuImages) && menuImages.length > 0) {
      for (const img of menuImages) {
        if (typeof img === "string" && img.startsWith("data:")) {
          const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          const result = await uploadToCloudinary(buffer, {
            folder: "appzeto/restaurant/menu",
            resource_type: "image"
          });
          menuImagesData.push({
            url: result.secure_url,
            publicId: result.public_id
          });
        } else if (typeof img === "string" && img.startsWith("http")) {
          menuImagesData.push({
            url: img
          });
        } else if (img.url) {
          menuImagesData.push(img);
        }
      }
    }

    // Upload document images
    let panImageData = null;
    if (panImage) {
      if (typeof panImage === "string" && panImage.startsWith("data:")) {
        const base64Data = panImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/restaurant/pan",
          resource_type: "image"
        });
        panImageData = {
          url: result.secure_url,
          publicId: result.public_id
        };
      } else if (typeof panImage === "string" && panImage.startsWith("http")) {
        panImageData = {
          url: panImage
        };
      } else if (panImage.url) {
        panImageData = panImage;
      }
    }
    let gstImageData = null;
    if (gstRegistered && gstImage) {
      if (typeof gstImage === "string" && gstImage.startsWith("data:")) {
        const base64Data = gstImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/restaurant/gst",
          resource_type: "image"
        });
        gstImageData = {
          url: result.secure_url,
          publicId: result.public_id
        };
      } else if (typeof gstImage === "string" && gstImage.startsWith("http")) {
        gstImageData = {
          url: gstImage
        };
      } else if (gstImage.url) {
        gstImageData = gstImage;
      }
    }
    let fssaiImageData = null;
    if (fssaiImage) {
      if (typeof fssaiImage === "string" && fssaiImage.startsWith("data:")) {
        const base64Data = fssaiImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const result = await uploadToCloudinary(buffer, {
          folder: "appzeto/restaurant/fssai",
          resource_type: "image"
        });
        fssaiImageData = {
          url: result.secure_url,
          publicId: result.public_id
        };
      } else if (typeof fssaiImage === "string" && fssaiImage.startsWith("http")) {
        fssaiImageData = {
          url: fssaiImage
        };
      } else if (fssaiImage.url) {
        fssaiImageData = fssaiImage;
      }
    }

    // Create restaurant data
    const restaurantData = {
      name: restaurantName,
      ownerName,
      ownerEmail,
      ownerPhone: ownerPhone ? normalizePhoneNumber(ownerPhone) || normalizedPhone : normalizedPhone,
      primaryContactNumber: primaryContactNumber ? normalizePhoneNumber(primaryContactNumber) || normalizedPhone : normalizedPhone,
      location: location || {},
      profileImage: profileImageData,
      menuImages: menuImagesData,
      cuisines: cuisines || [],
      deliveryTimings: {
        openingTime: openingTime || "09:00",
        closingTime: closingTime || "22:00"
      },
      openDays: openDays || ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      estimatedDeliveryTime: estimatedDeliveryTime || "25-30 mins",
      featuredDish: featuredDish || "",
      featuredPrice: featuredPrice || 249,
      offer: offer || "",
      signupMethod,
      // Admin created restaurants are active by default
      isActive: true,
      isAcceptingOrders: true,
      approvedAt: new Date(),
      approvedBy: adminId
    };

    // Add authentication fields
    if (email) {
      restaurantData.email = email.toLowerCase().trim();
      restaurantData.password = finalPassword; // Will be hashed by pre-save hook
    }
    if (normalizedPhone) {
      restaurantData.phone = normalizedPhone;
      restaurantData.phoneVerified = true; // Admin created, so verified
    }

    // Add onboarding data
    restaurantData.onboarding = {
      step1: {
        restaurantName,
        ownerName,
        ownerEmail,
        ownerPhone: ownerPhone ? normalizePhoneNumber(ownerPhone) || normalizedPhone : normalizedPhone,
        primaryContactNumber: primaryContactNumber ? normalizePhoneNumber(primaryContactNumber) || normalizedPhone : normalizedPhone,
        location: location || {}
      },
      step2: {
        menuImageUrls: menuImagesData,
        profileImageUrl: profileImageData,
        cuisines: cuisines || [],
        deliveryTimings: {
          openingTime: openingTime || "09:00",
          closingTime: closingTime || "22:00"
        },
        openDays: openDays || []
      },
      step3: {
        pan: {
          panNumber: panNumber || "",
          nameOnPan: nameOnPan || "",
          image: panImageData
        },
        gst: {
          isRegistered: gstRegistered || false,
          gstNumber: gstNumber || "",
          legalName: gstLegalName || "",
          address: gstAddress || "",
          image: gstImageData
        },
        fssai: {
          registrationNumber: fssaiNumber || "",
          expiryDate: fssaiExpiry || null,
          image: fssaiImageData
        },
        bank: {
          accountNumber: accountNumber || "",
          ifscCode: ifscCode || "",
          accountHolderName: accountHolderName || "",
          accountType: accountType || ""
        }
      },
      step4: {
        estimatedDeliveryTime: estimatedDeliveryTime || "25-30 mins",
        featuredDish: featuredDish || "",
        featuredPrice: featuredPrice || 249,
        offer: offer || ""
      },
      completedSteps: 4
    };

    // Create restaurant
    const restaurant = await Restaurant.create(restaurantData);
    try {
      await applyZoneTierToRestaurantById(restaurant._id);
    } catch (zoneErr) {
      logger.warn(`Zone/tier assignment for admin-created restaurant failed: ${zoneErr.message}`);
    }
    // Prepare response data
    const responseData = {
      restaurant: {
        id: restaurant._id,
        restaurantId: restaurant.restaurantId,
        name: restaurant.name,
        email: restaurant.email,
        phone: restaurant.phone,
        isActive: restaurant.isActive,
        slug: restaurant.slug
      }
    };

    // Include generated password in response if email was provided and password was auto-generated
    // This allows admin to share the password with the restaurant
    if (email && !password && finalPassword) {
      responseData.generatedPassword = finalPassword;
      responseData.message = "Restaurant created successfully. Please share the generated password with the restaurant.";
    }
    return successResponse(res, 201, "Restaurant created successfully", responseData);
  } catch (error) {
    logger.error(`Error creating restaurant: ${error.message}`, {
      error: error.stack
    });

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      return errorResponse(res, 400, `Restaurant with this ${field} already exists`);
    }
    return errorResponse(res, 500, `Failed to create restaurant: ${error.message}`);
  }
});

/**
 * Delete Restaurant
 * DELETE /api/admin/restaurants/:id
 */
export const deleteRestaurant = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const adminId = req.user._id;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    // Delete restaurant
    await Restaurant.findByIdAndDelete(id);
    return successResponse(res, 200, "Restaurant deleted successfully", {
      restaurant: {
        id: id,
        name: restaurant.name
      }
    });
  } catch (error) {
    logger.error(`Error deleting restaurant: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to delete restaurant");
  }
});

/**
 * Get All Offers with Restaurant and Dish Details
 * GET /api/admin/offers
 * Query params: page, limit, search, status, restaurantId
 */
export const getAllOffers = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      status,
      restaurantId
    } = req.query;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }
    if (restaurantId) {
      query.restaurant = restaurantId;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch offers with restaurant details
    // Fetch offers with projection
    const offers = await Offer.find(query)
      .select("restaurant items status discountType startDate endDate createdAt")
      .populate("restaurant", "name restaurantId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Offer.countDocuments(query);

    // Flatten offers to show each item separately
    const offerItems = [];
    offers.forEach((offer, offerIndex) => {
      if (offer.items && offer.items.length > 0) {
        offer.items.forEach((item, itemIndex) => {
          // Apply search filter if provided
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesSearch = offer.restaurant?.name?.toLowerCase().includes(searchLower) || item.itemName?.toLowerCase().includes(searchLower) || item.couponCode?.toLowerCase().includes(searchLower);
            if (!matchesSearch) {
              return; // Skip this item if it doesn't match search
            }
          }
          offerItems.push({
            sl: skip + offerItems.length + 1,
            offerId: offer._id.toString(),
            restaurantName: offer.restaurant?.name || "Unknown Restaurant",
            restaurantId: offer.restaurant?.restaurantId || offer.restaurant?._id?.toString() || "N/A",
            dishName: item.itemName || "Unknown Dish",
            dishId: item.itemId || "N/A",
            couponCode: item.couponCode || "N/A",
            discountType: offer.discountType || "percentage",
            discountPercentage: item.discountPercentage || 0,
            originalPrice: item.originalPrice || 0,
            discountedPrice: item.discountedPrice || 0,
            status: offer.status || "active",
            startDate: offer.startDate || null,
            endDate: offer.endDate || null,
            createdAt: offer.createdAt || new Date()
          });
        });
      }
    });

    // If search was applied, we need to recalculate total
    let filteredTotal = offerItems.length;
    if (!search) {
      // Count all items across all offers
      const allOffers = await Offer.find(query).lean();
      filteredTotal = allOffers.reduce((sum, offer) => sum + (offer.items?.length || 0), 0);
    }
    return successResponse(res, 200, "Offers retrieved successfully", {
      offers: offerItems,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching offers: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to fetch offers");
  }
});

/**
 * Get Restaurant Analytics for POS
 * GET /api/admin/restaurant-analytics/:restaurantId
 */
export const getRestaurantAnalytics = asyncHandler(async (req, res) => {
  try {
    const {
      restaurantId
    } = req.params;
    if (!restaurantId) {
      return errorResponse(res, 400, "Restaurant ID is required");
    }
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      logger.warn(`Invalid restaurant ID format: ${restaurantId}`);
      return errorResponse(res, 400, "Invalid restaurant ID format");
    }

    // Get restaurant details
    const restaurant = await Restaurant.findById(restaurantId).lean();
    if (!restaurant) {
      logger.warn(`Restaurant not found: ${restaurantId}`);
      return errorResponse(res, 404, "Restaurant not found");
    }
    // Calculate date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get order statistics - restaurantId can be _id or restaurantId field (both as String in Order model)
    // Match by both restaurant._id and restaurant.restaurantId
    const restaurantIdString = restaurantId.toString();
    const restaurantIdField = restaurant?.restaurantId || restaurantIdString;
    const restaurantObjectIdString = restaurant._id.toString();
    // Build query to match restaurantId in multiple formats
    const orderMatchQuery = {
      $or: [{
        restaurantId: restaurantIdString
      }, {
        restaurantId: restaurantIdField
      }, {
        restaurantId: restaurantObjectIdString
      }]
    };
    const restaurantIdForSettlement = restaurant._id instanceof mongoose.Types.ObjectId ? restaurant._id : new mongoose.Types.ObjectId(restaurant._id);
    const last12MonthsStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const RestaurantCommission = (await import("../models/RestaurantCommission.js")).default;
    const FeedbackExperience = (await import("../models/FeedbackExperience.js")).default;

    const [orderInsights, settlementInsights, commissionConfigRaw, ratingStats, totalCommissionConfigs] = await Promise.all([
      Order.aggregate([
        { $match: orderMatchQuery },
        {
          $facet: {
            statusStats: [
              {
                $group: {
                  _id: "$status",
                  count: { $sum: 1 },
                  totalRevenue: {
                    $sum: {
                      $cond: [
                        { $eq: ["$status", "delivered"] },
                        { $ifNull: ["$pricing.total", 0] },
                        0
                      ]
                    }
                  }
                }
              }
            ],
            monthlyDelivered: [
              { $match: { status: "delivered", createdAt: { $gte: startOfMonth } } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  revenue: { $sum: { $ifNull: ["$pricing.total", 0] } }
                }
              }
            ],
            yearlyDelivered: [
              { $match: { status: "delivered", createdAt: { $gte: startOfYear } } },
              {
                $group: {
                  _id: null,
                  count: { $sum: 1 },
                  revenue: { $sum: { $ifNull: ["$pricing.total", 0] } }
                }
              }
            ],
            customerSummary: [
              { $match: { status: "delivered" } },
              { $group: { _id: "$userId", orderCount: { $sum: 1 } } },
              {
                $group: {
                  _id: null,
                  totalCustomers: { $sum: 1 },
                  repeatCustomers: {
                    $sum: {
                      $cond: [{ $gt: ["$orderCount", 1] }, 1, 0]
                    }
                  }
                }
              }
            ]
          }
        }
      ]),
      OrderSettlement.aggregate([
        { $match: { restaurantId: restaurantIdForSettlement } },
        {
          $facet: {
            summary: [
              {
                $group: {
                  _id: null,
                  totalCommission: { $sum: { $ifNull: ["$restaurantEarning.commission", 0] } },
                  totalRestaurantEarning: { $sum: { $ifNull: ["$restaurantEarning.netEarning", 0] } },
                  totalFoodPrice: { $sum: { $ifNull: ["$restaurantEarning.foodPrice", 0] } },
                  monthlyCommission: {
                    $sum: {
                      $cond: [{ $gte: ["$createdAt", startOfMonth] }, { $ifNull: ["$restaurantEarning.commission", 0] }, 0]
                    }
                  },
                  monthlyRestaurantEarning: {
                    $sum: {
                      $cond: [{ $gte: ["$createdAt", startOfMonth] }, { $ifNull: ["$restaurantEarning.netEarning", 0] }, 0]
                    }
                  },
                  yearlyCommission: {
                    $sum: {
                      $cond: [{ $gte: ["$createdAt", startOfYear] }, { $ifNull: ["$restaurantEarning.commission", 0] }, 0]
                    }
                  },
                  yearlyRestaurantEarning: {
                    $sum: {
                      $cond: [{ $gte: ["$createdAt", startOfYear] }, { $ifNull: ["$restaurantEarning.netEarning", 0] }, 0]
                    }
                  }
                }
              }
            ],
            monthlyBuckets: [
              { $match: { createdAt: { $gte: last12MonthsStart } } },
              {
                $group: {
                  _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" }
                  },
                  netEarning: { $sum: { $ifNull: ["$restaurantEarning.netEarning", 0] } }
                }
              }
            ]
          }
        }
      ]),
      RestaurantCommission.findOne({
        $or: [
          { restaurant: restaurantIdForSettlement, status: true },
          { restaurant: restaurantIdForSettlement },
          ...(restaurant?.restaurantId ? [{ restaurantId: restaurant.restaurantId, status: true }, { restaurantId: restaurant.restaurantId }] : [])
        ]
      })
        .sort({ status: -1, updatedAt: -1 })
        .lean(),
      FeedbackExperience.aggregate([{
        $match: {
          restaurantId: restaurantIdForSettlement,
          rating: {
            $exists: true,
            $ne: null,
            $gt: 0
          }
        }
      }, {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 }
        }
      }]),
      Order.aggregate([{
        $match: {
          ...orderMatchQuery,
          status: "delivered"
        }
      }, {
        $group: {
          _id: "$userId",
          orderCount: { $sum: 1 }
        }
      }]),
      RestaurantCommission.countDocuments({})
    ]);

    const orderAggregate = orderInsights[0] || {};
    const settlementAggregate = settlementInsights[0] || {};
    const orderStats = orderAggregate.statusStats || [];
    const monthlyStats = orderAggregate.monthlyDelivered || [];
    const yearlyStats = orderAggregate.yearlyDelivered || [];
    const customerSummary = orderAggregate.customerSummary?.[0] || {};
    const settlementStats = settlementAggregate.summary || [];
    const monthlySettlementBuckets = settlementAggregate.monthlyBuckets || [];

    const orderStatusMap = {};
    let totalRevenue = 0;
    orderStats.forEach(stat => {
      orderStatusMap[stat._id] = stat.count;
      if (stat._id === "delivered") {
        totalRevenue += stat.totalRevenue || 0;
      }
    });
    const totalOrders = (orderStatusMap.delivered || 0) + (orderStatusMap.cancelled || 0) + (orderStatusMap.pending || 0) + (orderStatusMap.confirmed || 0) + (orderStatusMap.preparing || 0) + (orderStatusMap.ready || 0) + (orderStatusMap.out_for_delivery || 0);
    const completedOrders = orderStatusMap.delivered || 0;
    const cancelledOrders = orderStatusMap.cancelled || 0;
    const monthlyOrders = monthlyStats[0]?.count || 0;
    const yearlyOrders = yearlyStats[0]?.count || 0;

    const settlementSummary = settlementStats[0] || {};
    let totalCommission = Math.round((settlementSummary.totalCommission || 0) * 100) / 100;
    let totalRestaurantEarning = Math.round((settlementSummary.totalRestaurantEarning || 0) * 100) / 100;
    let monthlyRestaurantEarning = Math.round((settlementSummary.monthlyRestaurantEarning || 0) * 100) / 100;
    let yearlyRestaurantEarning = Math.round((settlementSummary.yearlyRestaurantEarning || 0) * 100) / 100;

    const monthlyEarningsMap = new Map();
    monthlySettlementBuckets.forEach((bucket) => {
      const monthKey = `${bucket._id.year}-${bucket._id.month - 1}`;
      monthlyEarningsMap.set(monthKey, bucket.netEarning || 0);
    });
    const avgMonthlyProfit = monthlyEarningsMap.size > 0
      ? Array.from(monthlyEarningsMap.values()).reduce((sum, val) => sum + val, 0) / monthlyEarningsMap.size
      : 0;

    let commissionConfig = commissionConfigRaw || null;
    const restaurantIdForQuery = restaurantIdForSettlement;
    if (!commissionConfig) {
      logger.warn(`❌ No commission found. Total commissions in DB: ${totalCommissionConfigs}`);
    }
    let commissionPercentage = 0;
    if (commissionConfig) {
      if (commissionConfig.defaultCommission) {
        // Get default commission value - if type is percentage, show the percentage value

        if (commissionConfig.defaultCommission.type === "percentage") {
          const rawValue = commissionConfig.defaultCommission.value;
          commissionPercentage = typeof rawValue === "number" ? rawValue : parseFloat(rawValue) || 0;
        } else if (commissionConfig.defaultCommission.type === "amount") {
          // For amount type, we can't show a percentage, so keep it as 0
          commissionPercentage = 0;
        }
      } else {
        logger.warn(`⚠️ Commission config found but no defaultCommission for restaurant ${restaurantId}`);
      }
    } else {
      logger.warn(`❌ No commission config found for restaurant ${restaurantId} (restaurant._id: ${restaurantIdForQuery.toString()})`);
      logger.warn(`⚠️ This restaurant may not have a commission configuration set up.`);
      logger.warn(`💡 To set up commission, go to Restaurant Commission page and add commission for this restaurant.`);
    }

    // Log the final commission percentage being returned

    // Get ratings from FeedbackExperience (restaurantId is ObjectId in FeedbackExperience)
    const averageRating = ratingStats[0]?.averageRating || 0;
    const totalRatings = ratingStats[0]?.totalRatings || 0;
    const totalCustomers = customerSummary.totalCustomers || 0;
    const repeatCustomers = customerSummary.repeatCustomers || 0;

    // Calculate average order value
    const averageOrderValue = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Calculate rates
    const cancellationRate = totalOrders > 0 ? cancelledOrders / totalOrders * 100 : 0;
    const completionRate = totalOrders > 0 ? completedOrders / totalOrders * 100 : 0;

    // Calculate average yearly profit (if restaurant has been active for multiple years)
    const restaurantCreatedAt = restaurant.createdAt || new Date();
    const yearsActive = Math.max(1, (now - restaurantCreatedAt) / (365 * 24 * 60 * 60 * 1000));
    const averageYearlyProfit = yearsActive > 0 ? yearlyRestaurantEarning / yearsActive : yearlyRestaurantEarning;
    return successResponse(res, 200, "Restaurant analytics retrieved successfully", {
      restaurant: {
        _id: restaurant._id,
        name: restaurant.name,
        restaurantId: restaurant.restaurantId,
        isActive: restaurant.isActive,
        createdAt: restaurant.createdAt
      },
      analytics: {
        totalOrders: Number(totalOrders) || 0,
        cancelledOrders: Number(cancelledOrders) || 0,
        completedOrders: Number(completedOrders) || 0,
        averageRating: averageRating ? parseFloat(averageRating.toFixed(1)) : 0,
        totalRatings: Number(totalRatings) || 0,
        commissionPercentage: Number(commissionPercentage) || 0,
        monthlyProfit: parseFloat(monthlyRestaurantEarning.toFixed(2)),
        yearlyProfit: parseFloat(yearlyRestaurantEarning.toFixed(2)),
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalCommission: parseFloat(totalCommission.toFixed(2)),
        restaurantEarning: parseFloat(totalRestaurantEarning.toFixed(2)),
        monthlyOrders,
        yearlyOrders,
        averageMonthlyProfit: parseFloat(avgMonthlyProfit.toFixed(2)),
        averageYearlyProfit: parseFloat(averageYearlyProfit.toFixed(2)),
        status: restaurant.isActive ? "active" : "inactive",
        joinDate: restaurant.createdAt,
        totalCustomers,
        repeatCustomers,
        cancellationRate: parseFloat(cancellationRate.toFixed(2)),
        completionRate: parseFloat(completionRate.toFixed(2))
      }
    });
  } catch (error) {
    logger.error(`Error fetching restaurant analytics: ${error.message}`, {
      error: error.stack
    });
    return errorResponse(res, 500, "Failed to fetch restaurant analytics");
  }
});

/**
 * Get Customer Wallet Report
 * GET /api/admin/customer-wallet-report
 * Query params: fromDate, toDate, all (Credit/Debit), customer, search
 */
export const getCustomerWalletReport = asyncHandler(async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      all,
      customer,
      search
    } = req.query;
    const UserWallet = (await import("../../user/models/UserWallet.js")).default;
    const User = (await import("../../auth/models/User.js")).default;

    // Build date filter
    let dateFilter = {};
    if (fromDate || toDate) {
      dateFilter["transactions.createdAt"] = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        dateFilter["transactions.createdAt"].$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        dateFilter["transactions.createdAt"].$lte = endDate;
      }
    }

    // Get all wallets with transactions
    // Get wallets with projection and transactions
    const wallets = await UserWallet.find({
      ...dateFilter,
      "transactions.0": { $exists: true }
    })
      .select("userId transactions balance currency")
      .populate("userId", "name email phone")
      .lean();

    // Flatten transactions with user info
    let allTransactions = [];
    wallets.forEach(wallet => {
      if (!wallet.userId) return;

      // Sort transactions by date (oldest first for balance calculation)
      const sortedTransactions = [...wallet.transactions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      let runningBalance = 0;
      sortedTransactions.forEach(transaction => {
        // Update running balance if transaction is completed (before date filter)
        let balance = runningBalance;
        if (transaction.status === "Completed") {
          if (transaction.type === "addition" || transaction.type === "refund") {
            runningBalance += transaction.amount;
            balance = runningBalance;
          } else if (transaction.type === "deduction") {
            runningBalance -= transaction.amount;
            balance = runningBalance;
          }
        }

        // Apply date filter if provided
        if (fromDate || toDate) {
          const transDate = new Date(transaction.createdAt);
          if (fromDate && transDate < new Date(fromDate)) return;
          if (toDate) {
            const toDateObj = new Date(toDate);
            toDateObj.setHours(23, 59, 59, 999);
            if (transDate > toDateObj) return;
          }
        }

        // Map transaction type to frontend format
        let transactionType = "CashBack";
        if (transaction.type === "addition") {
          if (transaction.description?.includes("Admin") || transaction.description?.includes("admin")) {
            transactionType = "Add Fund By Admin";
          } else {
            transactionType = "Add Fund";
          }
        } else if (transaction.type === "deduction") {
          transactionType = "Order Payment";
        } else if (transaction.type === "refund") {
          transactionType = "Refund";
        }

        // Get reference
        let reference = "N/A";
        if (transaction.orderId) {
          reference = transaction.orderId.toString();
        } else if (transaction.paymentGateway) {
          reference = transaction.paymentGateway;
        } else if (transaction.description) {
          reference = transaction.description;
        }
        allTransactions.push({
          _id: transaction._id,
          transactionId: transaction._id.toString(),
          customer: wallet.userId.name || "Unknown",
          customerId: wallet.userId._id.toString(),
          credit: transaction.type === "addition" || transaction.type === "refund" ? transaction.amount : 0,
          debit: transaction.type === "deduction" ? transaction.amount : 0,
          balance: balance,
          transactionType: transactionType,
          reference: reference,
          createdAt: transaction.createdAt,
          status: transaction.status,
          type: transaction.type
        });
      });
    });

    // Filter by transaction type (Credit/Debit)
    if (all && all !== "All") {
      if (all === "Credit") {
        allTransactions = allTransactions.filter(t => t.credit > 0);
      } else if (all === "Debit") {
        allTransactions = allTransactions.filter(t => t.debit > 0);
      }
    }

    // Filter by customer
    if (customer && customer !== "Select Customer") {
      allTransactions = allTransactions.filter(t => t.customer.toLowerCase().includes(customer.toLowerCase()));
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      allTransactions = allTransactions.filter(t => t.transactionId.toLowerCase().includes(searchLower) || t.customer.toLowerCase().includes(searchLower) || t.reference.toLowerCase().includes(searchLower));
    }

    // Sort by date (newest first)
    allTransactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Format currency
    const formatCurrency = amount => {
      return `₹${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    };

    // Format date
    const formatDate = date => {
      const d = new Date(date);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const day = d.getDate();
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let hours = d.getHours();
      const minutes = d.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day} ${month} ${year} ${hours}:${minutes} ${ampm}`;
    };

    // Transform transactions for frontend
    const transformedTransactions = allTransactions.map((transaction, index) => ({
      sl: index + 1,
      transactionId: transaction.transactionId,
      customer: transaction.customer,
      credit: formatCurrency(transaction.credit),
      debit: formatCurrency(transaction.debit),
      balance: formatCurrency(transaction.balance),
      transactionType: transaction.transactionType,
      reference: transaction.reference,
      createdAt: formatDate(transaction.createdAt)
    }));

    // Calculate summary statistics
    const totalDebit = allTransactions.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = allTransactions.reduce((sum, t) => sum + t.credit, 0);
    const totalBalance = totalCredit - totalDebit;

    // Get unique customers for dropdown
    const uniqueCustomers = [...new Set(allTransactions.map(t => t.customer))].sort();
    return successResponse(res, 200, "Customer wallet report retrieved successfully", {
      transactions: transformedTransactions,
      stats: {
        debit: formatCurrency(totalDebit),
        credit: formatCurrency(totalCredit),
        balance: formatCurrency(totalBalance)
      },
      customers: uniqueCustomers,
      pagination: {
        page: 1,
        limit: 10000,
        total: transformedTransactions.length,
        pages: 1
      }
    });
  } catch (error) {
    console.error("❌ Error fetching customer wallet report:", error);
    console.error("Error stack:", error.stack);
    return errorResponse(res, 500, error.message || "Failed to fetch customer wallet report");
  }
});

/**
 * Extend Restaurant Subscription
 * POST /api/admin/restaurants/:id/extend-subscription
 */
export const extendRestaurantSubscription = asyncHandler(async (req, res) => {
  try {
    const {
      id
    } = req.params;
    const {
      days
    } = req.body;
    if (!days || isNaN(days) || days <= 0) {
      return errorResponse(res, 400, "Valid number of days is required");
    }
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return errorResponse(res, 404, "Restaurant not found");
    }

    // Initialize subscription if it doesn't exist
    if (!restaurant.subscription) {
      restaurant.subscription = {
        status: "inactive",
        endDate: new Date(),
        features: []
      };
    }
    const currentEndDate = restaurant.subscription.endDate ? new Date(restaurant.subscription.endDate) : new Date();

    // If subscription is already expired, start from today
    let newEndDate;
    if (currentEndDate < new Date()) {
      newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + parseInt(days));
    } else {
      // Extend from current end date
      newEndDate = new Date(currentEndDate);
      newEndDate.setDate(newEndDate.getDate() + parseInt(days));
    }
    restaurant.subscription.endDate = newEndDate;
    restaurant.subscription.status = "active";
    // Also set autoRenew to true if we are manually extending, usually implies active intent
    restaurant.subscription.autoRenew = true;

    // Ensure business model is updated if needed
    if (restaurant.businessModel !== "Subscription Base") {
      restaurant.businessModel = "Subscription Base";
    }
    await restaurant.save();
    return successResponse(res, 200, "Subscription extended successfully", {
      subscription: restaurant.subscription
    });
  } catch (error) {
    logger.error(`Error extending subscription: ${error.message}`);
    return errorResponse(res, 500, "Failed to extend subscription");
  }
});
