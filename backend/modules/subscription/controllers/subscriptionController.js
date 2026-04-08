import SubscriptionPlan from "../../admin/models/SubscriptionPlan.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import RestaurantSubscription from "../../restaurant/models/RestaurantSubscription.js";
import RelationshipRequest from "../../restaurant/models/RelationshipRequest.js";
import * as razorpayService from "../../payment/services/razorpayService.js";
import { getRazorpayCredentials } from "../../../shared/utils/envService.js";
import mongoose from "mongoose";

const getRestaurantTierKey = (restaurant) => {
  if (restaurant?.zoneId?.tierId?.rank) {
    return `tier${restaurant.zoneId.tierId.rank}`;
  }
  return "tier1";
};

const getPlanAmountForRestaurant = (plan, restaurant) => {
  const tierKey = getRestaurantTierKey(restaurant);
  if (plan?.pricing && plan.pricing[tierKey] !== undefined) {
    return plan.pricing[tierKey];
  }
  return plan?.pricing?.tier1 || 0;
};

const roundToTwo = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getSubscriptionBillingForRestaurant = (plan, restaurant) => {
  const baseAmount = roundToTwo(getPlanAmountForRestaurant(plan, restaurant));
  const gstAmount = roundToTwo(baseAmount * 0.18);
  const totalAmount = roundToTwo(baseAmount + gstAmount);

  return {
    baseAmount,
    gstRate: 18,
    gstAmount,
    totalAmount
  };
};

const hasActiveSubscription = (restaurant) => {
  if (!restaurant?.subscription) return false;
  const now = new Date();
  return (
    restaurant.subscription.status === "active" &&
    restaurant.subscription.endDate &&
    new Date(restaurant.subscription.endDate) > now
  );
};

const buildSubscriptionHistoryPipelines = ({
  period,
  paymentStatus = "completed",
  tierId,
  planId,
  search
} = {}) => {
  const now = new Date();
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

  const baseMatch = {};
  if (paymentStatus && paymentStatus !== "all") {
    baseMatch.paymentStatus = paymentStatus;
  }
  if (planId && mongoose.Types.ObjectId.isValid(planId)) {
    baseMatch.planId = new mongoose.Types.ObjectId(planId);
  }
  if (startDate) {
    baseMatch.$or = [
      { paymentDate: { $gte: startDate } },
      { paymentDate: { $exists: false }, createdAt: { $gte: startDate } }
    ];
  }

  const lookupStages = [
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
        },
        purchaseDate: { $ifNull: ["$paymentDate", "$createdAt"] }
      }
    }
  ];

  const postLookupMatch = {};
  if (tierId && tierId !== "all" && mongoose.Types.ObjectId.isValid(tierId)) {
    postLookupMatch["tier._id"] = new mongoose.Types.ObjectId(tierId);
  }
  if (search?.trim()) {
    const regex = new RegExp(search.trim(), "i");
    postLookupMatch.$or = [
      { "restaurant.name": regex },
      { "restaurant.restaurantId": regex },
      { "restaurant.email": regex },
      { "restaurant.phone": regex },
      { razorpayPaymentId: regex },
      { razorpayOrderId: regex }
    ];
  }

  return {
    baseMatch,
    lookupStages,
    postLookupMatch
  };
};

/**
 * Get all active subscription plans
 */
export const getPlans = async (req, res) => {
  try {
    let query = { isActive: true };

    if (req.admin || (req.user && req.user.role === "admin")) {
      query = {};
    }

    const plans = await SubscriptionPlan.find(query).lean();

    let restaurant = req.restaurant || null;
    if (!restaurant && req.user && req.user.role === "restaurant") {
      restaurant = await Restaurant.findById(req.user._id || req.user.id).populate({
        path: "zoneId",
        populate: { path: "tierId" },
      });
    }

    plans.forEach((plan) => {
      plan.price = getPlanAmountForRestaurant(plan, restaurant);
      if (restaurant?.zoneId?.tierId?.name) {
        plan.tierName = restaurant.zoneId.tierId.name;
      }
    });

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription plans",
    });
  }
};

/**
 * Subscribe a restaurant to a plan (creates Razorpay order for paid plans)
 */
export const subscribe = async (req, res) => {
  try {
    const { planId } = req.body;
    const restaurantId = req.user._id || req.user.id;

    if (!planId) {
      return res.status(400).json({
        success: false,
        message: "Plan ID is required",
      });
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    if (!plan.isActive) {
      return res.status(400).json({
        success: false,
        message: "This subscription plan is currently disabled",
      });
    }

    const restaurant = await Restaurant.findById(restaurantId).populate({
      path: "zoneId",
      populate: { path: "tierId" },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    const alreadyActive = hasActiveSubscription(restaurant);
    const isCurrentPlan =
      restaurant.subscription?.planId?.toString() === plan._id.toString();

    const billing = getSubscriptionBillingForRestaurant(plan, restaurant);
    const amount = billing.totalAmount;

    if (amount === 0) {
      if (alreadyActive && !isCurrentPlan) {
        restaurant.queuedSubscription = {
          planId: plan._id,
          durationInDays: plan.durationInDays || 30,
          amount,
          features: plan.features,
          purchasedAt: new Date(),
          startAfter: restaurant.subscription.endDate,
          paymentId: `FREE_${Date.now()}`,
          paymentStatus: "completed",
          paymentDate: new Date(),
          status: "pending",
        };
        await restaurant.save();

        return res.status(200).json({
          success: true,
          message:
            "This is not your current active plan. It will activate automatically when your current plan expires.",
          data: {
            deferredActivation: true,
            currentPlan: restaurant.subscription,
            queuedSubscription: restaurant.queuedSubscription,
            plan,
          },
        });
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + (plan.durationInDays || 30));

      restaurant.subscription = {
        planId: plan._id,
        startDate,
        endDate,
        status: "active",
        autoRenew: true,
        paymentId: `FREE_${Date.now()}`,
        paymentStatus: "completed",
        paymentDate: startDate,
        amount,
        features: plan.features,
      };
      restaurant.businessModel = "Subscription Base";
      await restaurant.save();

      await RestaurantSubscription.create({
        restaurantId,
        planId: plan._id,
        startDate,
        endDate,
        trialUsed: !!restaurant.trialUsed,
        amount,
        paymentStatus: "completed",
        paymentDate: startDate,
        status: "active",
      });

      return res.status(200).json({
        success: true,
        message: "Free subscription activated successfully",
        data: {
          subscription: restaurant.subscription,
          plan,
          billing
        },
      });
    }

    const razorpayOrder = await razorpayService.createOrder({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `sub_${Date.now()}`,
      notes: {
        restaurantId: restaurantId.toString(),
        planId: planId.toString(),
        type: "subscription_purchase",
      },
    });

    const credentials = await getRazorpayCredentials();

    res.status(200).json({
      success: true,
      message:
        alreadyActive && !isCurrentPlan
          ? "Current plan is active. New plan will be activated automatically after expiry once payment is completed."
          : "Subscription order created successfully",
      data: {
        razorpay: {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          key: credentials.keyId,
        },
        plan,
        billing
      },
    });
  } catch (error) {
    console.error("Error subscribing to plan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to subscribe to plan",
    });
  }
};

/**
 * Claim 30-day Growth trial (one-time per restaurant)
 */
export const claimTrial = async (req, res) => {
  try {
    const restaurantId = req.user._id || req.user.id;
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    if (restaurant.trialUsed) {
      return res.status(400).json({
        success: false,
        message: "Trial already used",
      });
    }

    const now = new Date();
    const hasActiveSubscription =
      restaurant.subscription &&
      restaurant.subscription.status === "active" &&
      restaurant.subscription.endDate &&
      new Date(restaurant.subscription.endDate) > now;

    if (hasActiveSubscription) {
      return res.status(400).json({
        success: false,
        message: "Active subscription already exists",
      });
    }

    const growthPlan = await SubscriptionPlan.findOne({ name: "GROWTH", isActive: true });
    if (!growthPlan) {
      return res.status(404).json({
        success: false,
        message: "Growth plan not available",
      });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + (growthPlan.durationInDays || 30));

    restaurant.subscription = {
      planId: growthPlan._id,
      startDate,
      endDate,
      status: "active",
      autoRenew: false,
      paymentId: `TRIAL_${Date.now()}`,
      paymentStatus: "completed",
      paymentDate: startDate,
      amount: 0,
      features: growthPlan.features,
    };
    restaurant.businessModel = "Subscription Base";
    restaurant.trialUsed = true;
    await restaurant.save();

    await RestaurantSubscription.create({
      restaurantId,
      planId: growthPlan._id,
      startDate,
      endDate,
      trialUsed: true,
      amount: 0,
      paymentStatus: "completed",
      paymentDate: startDate,
      status: "active",
    });

    return res.status(200).json({
      success: true,
      message: "Trial activated successfully",
      data: {
        subscription: restaurant.subscription,
        plan: growthPlan,
      },
    });
  } catch (error) {
    console.error("Error claiming trial:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to activate trial",
    });
  }
};

export const createSubscriptionOrder = subscribe;

/**
 * Get current subscription details
 */
export const getMySubscription = async (req, res) => {
  try {
    const restaurantId = req.user._id || req.user.id;
    const restaurant = await Restaurant.findById(restaurantId)
      .populate("subscription.planId")
      .populate("queuedSubscription.planId");

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    if (!restaurant.subscription || !restaurant.subscription.planId) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "No active subscription",
      });
    }

    res.status(200).json({
      success: true,
      data: restaurant.subscription,
      queuedSubscription:
        restaurant.queuedSubscription?.status === "pending"
          ? restaurant.queuedSubscription
          : null,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscription details",
    });
  }
};

export const getMyPlan = getMySubscription;

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
  try {
    const restaurantId = req.user._id || req.user.id;
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    if (restaurant.subscription) {
      restaurant.subscription.autoRenew = false;
      await restaurant.save();
    }

    res.status(200).json({
      success: true,
      message: "Subscription auto-renewal cancelled. Plan remains active until end date.",
      data: restaurant.subscription,
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
    });
  }
};

/**
 * Create a new subscription plan (Admin)
 */
export const createPlan = async (req, res) => {
  try {
    const { name, pricing, durationInDays, features, isActive } = req.body;

    const plan = await SubscriptionPlan.create({
      name,
      pricing,
      durationInDays,
      features,
      isActive,
    });

    res.status(201).json({
      success: true,
      data: plan,
      message: "Subscription plan created successfully",
    });
  } catch (error) {
    console.error("Error creating plan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create subscription plan",
      error: error.message,
    });
  }
};

/**
 * Update a subscription plan (Admin)
 */
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const plan = await SubscriptionPlan.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    res.status(200).json({
      success: true,
      data: plan,
      message: "Subscription plan updated successfully",
    });
  } catch (error) {
    console.error("Error updating plan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update subscription plan",
      error: error.message,
    });
  }
};

/**
 * Update subscription plan pricing only (Admin)
 */
export const updatePlanPrice = async (req, res) => {
  try {
    const { planId, pricing } = req.body;

    if (!planId || !pricing) {
      return res.status(400).json({
        success: false,
        message: "planId and pricing are required",
      });
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      planId,
      { pricing },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: plan,
      message: "Subscription price updated successfully",
    });
  } catch (error) {
    console.error("Error updating plan price:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update subscription plan price",
      error: error.message,
    });
  }
};

/**
 * Delete a subscription plan (Admin)
 */
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findByIdAndDelete(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Subscription plan deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting plan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete subscription plan",
      error: error.message,
    });
  }
};

/**
 * Toggle plan status (Admin)
 */
export const togglePlanStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await SubscriptionPlan.findById(id);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    plan.isActive = !plan.isActive;
    await plan.save();

    res.status(200).json({
      success: true,
      data: plan,
      message: `Plan ${plan.isActive ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    console.error("Error toggling plan status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update plan status",
      error: error.message,
    });
  }
};

/**
 * List restaurant subscriptions (Admin)
 */
export const getRestaurantSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const query = {};
    if (status) {
      query["subscription.status"] = status;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ name: regex }, { email: regex }, { phone: regex }, { restaurantId: regex }];
    }

    const [restaurants, total] = await Promise.all([
      Restaurant.find(query)
        .select("name restaurantId email phone trialUsed subscription businessModel createdAt")
        .populate("subscription.planId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Restaurant.countDocuments(query),
    ]);

    const now = new Date();
    const data = restaurants.map((restaurant) => {
      const endDate = restaurant.subscription?.endDate ? new Date(restaurant.subscription.endDate) : null;
      const isExpired = endDate ? endDate < now : true;
      return {
        restaurantId: restaurant._id,
        name: restaurant.name,
        restaurantCode: restaurant.restaurantId,
        email: restaurant.email,
        phone: restaurant.phone,
        trialUsed: !!restaurant.trialUsed,
        subscription: {
          ...restaurant.subscription,
          status: isExpired && restaurant.subscription?.status === "active" ? "expired" : restaurant.subscription?.status,
        },
      };
    });

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
      },
    });
  } catch (error) {
    console.error("Error fetching restaurant subscriptions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch restaurant subscriptions",
      error: error.message,
    });
  }
};

/**
 * List subscription purchase history (Admin)
 */
export const getSubscriptionHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      paymentStatus = "completed",
      period = "overall",
      tierId,
      planId,
      search = ""
    } = req.query;

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (currentPage - 1) * perPage;

    const {
      baseMatch,
      lookupStages,
      postLookupMatch
    } = buildSubscriptionHistoryPipelines({
      period,
      paymentStatus,
      tierId,
      planId,
      search
    });

    const historyAgg = await RestaurantSubscription.aggregate([
      { $match: baseMatch },
      ...lookupStages,
      ...(Object.keys(postLookupMatch).length ? [{ $match: postLookupMatch }] : []),
      { $sort: { purchaseDate: -1, createdAt: -1, _id: -1 } },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: perPage },
            {
              $project: {
                _id: 1,
                purchaseDate: 1,
                restaurantName: "$restaurant.name",
                restaurantCode: "$restaurant.restaurantId",
                restaurantEmail: "$restaurant.email",
                restaurantPhone: "$restaurant.phone",
                planName: "$plan.name",
                tierName: "$tier.name",
                tierId: "$tier._id",
                planId: "$plan._id",
                amount: { $round: [{ $ifNull: ["$effectiveAmount", 0] }, 2] },
                paymentStatus: 1,
                razorpayOrderId: 1,
                razorpayPaymentId: 1,
                subscriptionStatus: "$status",
                durationInDays: "$plan.durationInDays"
              }
            }
          ],
          meta: [
            {
              $group: {
                _id: null,
                totalSales: { $sum: 1 },
                totalCollection: { $sum: { $ifNull: ["$effectiveAmount", 0] } }
              }
            }
          ]
        }
      }
    ]);

    const rows = historyAgg[0]?.rows || [];
    const meta = historyAgg[0]?.meta?.[0] || { totalSales: 0, totalCollection: 0 };

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        page: currentPage,
        limit: perPage,
        total: meta.totalSales,
        totalPages: Math.ceil(meta.totalSales / perPage) || 1
      },
      summary: {
        totalSales: meta.totalSales || 0,
        totalCollection: Math.round((meta.totalCollection || 0) * 100) / 100
      }
    });
  } catch (error) {
    console.error("Error fetching subscription history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription history",
      error: error.message
    });
  }
};

/**
 * Verify subscription payment
 */
export const verifySubscriptionPayment = async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, planId } = req.body;
    const restaurantId = req.user._id || req.user.id;

    const isSignatureValid = await razorpayService.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Subscription plan not found",
      });
    }

    if (!plan.isActive) {
      return res.status(400).json({
        success: false,
        message: "This subscription plan is currently disabled",
      });
    }

    const restaurant = await Restaurant.findById(restaurantId).populate({
      path: "zoneId",
      populate: { path: "tierId" },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    const billing = getSubscriptionBillingForRestaurant(plan, restaurant);
    const amount = billing.totalAmount;
    const alreadyActive = hasActiveSubscription(restaurant);
    const isCurrentPlan =
      restaurant.subscription?.planId?.toString() === plan._id.toString();

    if (alreadyActive && !isCurrentPlan) {
      restaurant.queuedSubscription = {
        planId: plan._id,
        durationInDays: plan.durationInDays || 30,
        amount,
        features: plan.features,
        purchasedAt: new Date(),
        startAfter: restaurant.subscription.endDate,
        paymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paymentStatus: "completed",
        paymentDate: new Date(),
        status: "pending",
      };
      await restaurant.save();

      return res.status(200).json({
        success: true,
        message:
          "This is not your current active plan. It has been purchased and will activate automatically after your current plan expires.",
      data: {
        deferredActivation: true,
        currentPlan: restaurant.subscription,
        queuedSubscription: restaurant.queuedSubscription,
        billing
      },
    });
  }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + (plan.durationInDays || 30));

    restaurant.subscription = {
      planId: plan._id,
      startDate,
      endDate,
      status: "active",
      autoRenew: true,
      paymentId: razorpay_payment_id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      paymentStatus: "completed",
      paymentDate: startDate,
      amount,
      features: plan.features,
    };
    restaurant.businessModel = "Subscription Base";
    await restaurant.save();

    await RestaurantSubscription.create({
      restaurantId,
      planId: plan._id,
      startDate,
      endDate,
      trialUsed: !!restaurant.trialUsed,
      amount,
      paymentStatus: "completed",
      paymentDate: startDate,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      status: "active",
    });

    res.status(200).json({
      success: true,
      message: "Subscription payment verified and activated successfully",
      data: {
        subscription: restaurant.subscription,
        billing
      },
    });
  } catch (error) {
    console.error("Error verifying subscription payment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify subscription payment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Subscription module alias: request RM call
 */
export const requestRMCallViaSubscription = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const { notes } = req.body;

    const existingRequest = await RelationshipRequest.findOne({
      restaurantId,
      status: "pending",
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending call request. Our team will contact you soon.",
      });
    }

    const newRequest = await RelationshipRequest.create({
      restaurantId,
      notes,
      time: new Date(),
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Call request submitted successfully. Your Relationship Manager will contact you within 24 hours.",
      data: newRequest,
    });
  } catch (error) {
    console.error("[SubscriptionController] Error requesting RM call:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while processing your request.",
    });
  }
};

/**
 * Subscription module alias: get RM call history
 */
export const getRMCallHistoryViaSubscription = async (req, res) => {
  try {
    const restaurantId = req.restaurant._id;
    const history = await RelationshipRequest.find({ restaurantId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Call history retrieved successfully",
      data: history,
    });
  } catch (error) {
    console.error("[SubscriptionController] Error fetching RM call history:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error fetching call history.",
    });
  }
};
