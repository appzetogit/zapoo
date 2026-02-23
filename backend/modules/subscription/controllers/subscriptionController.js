import SubscriptionPlan from "../../admin/models/SubscriptionPlan.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import Payment from "../../payment/models/Payment.js";
import * as razorpayService from "../../payment/services/razorpayService.js";
import { getRazorpayCredentials } from "../../../shared/utils/envService.js";
import mongoose from "mongoose";

/**
 * Get all active subscription plans
 */
export const getPlans = async (req, res) => {
    try {
        let query = { isActive: true };

        // If admin is requesting, return all plans
        if ((req.admin) || (req.user && req.user.role === 'admin')) {
            query = {};
        }

        const plans = await SubscriptionPlan.find(query).lean();

        if (req.user && req.user.role === 'restaurant') {
            try {
                const restaurantId = req.user._id || req.user.id;
                const restaurant = await Restaurant.findById(restaurantId).populate({
                    path: 'zoneId',
                    populate: { path: 'tierId' }
                });


                if (restaurant && restaurant.zoneId && restaurant.zoneId.tierId && restaurant.zoneId.tierId.rank) {
                    const tierRank = restaurant.zoneId.tierId.rank; // Assuming 1, 2, 3, 4
                    const tierKey = `tier${tierRank}`;

                    // Adjust prices based on zone tier
                    plans.forEach(plan => {
                        if (plan.pricing && plan.pricing[tierKey] !== undefined) {
                            plan.price = plan.pricing[tierKey];
                            plan.tierName = restaurant.zoneId.tierId.name;
                        } else {
                            // Fallback to Tier 1 if specific tier price not found
                            plan.price = plan.pricing?.tier1 || 0;
                        }
                    });
                } else {
                    // Fallback if no tier assigned
                    plans.forEach(plan => {
                        plan.price = plan.pricing?.tier1 || 0;
                    });
                }
            } catch (err) {
                console.error("Error applying zone pricing:", err);
                // Continue with base prices if error occurs
            }
        } else {
            // For Admin or Public view, show tier 1 price as default
            plans.forEach(plan => {
                plan.price = plan.pricing?.tier1 || 0;
            });
        }

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
 * Subscribe a restaurant to a plan
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

        const restaurant = await Restaurant.findById(restaurantId).populate({
            path: 'zoneId',
            populate: { path: 'tierId' }
        });

        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found",
            });
        }

        // Calculate price based on zone tier
        let amount = 0;
        if (restaurant.zoneId && restaurant.zoneId.tierId && restaurant.zoneId.tierId.rank) {
            const tierRank = restaurant.zoneId.tierId.rank;
            const tierKey = `tier${tierRank}`;
            amount = plan.pricing[tierKey] !== undefined ? plan.pricing[tierKey] : (plan.pricing?.tier1 || 0);
        } else {
            amount = plan.pricing?.tier1 || 0;
        }

        if (amount === 0) {
            // Free plan logic or skip payment
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + (plan.durationInDays || 30));

            restaurant.subscription = {
                planId: plan._id,
                startDate: startDate,
                endDate: endDate,
                status: "active",
                autoRenew: true,
                paymentId: "FREE_" + Date.now(),
                features: plan.features,
            };
            restaurant.businessModel = "Subscription Base";
            await restaurant.save();

            return res.status(200).json({
                success: true,
                message: "Free subscription activated successfully",
                data: {
                    subscription: restaurant.subscription,
                    plan: plan
                },
            });
        }

        // Create Razorpay Order
        try {
            const razorpayOrder = await razorpayService.createOrder({
                amount: Math.round(amount * 100), // Convert to paise
                currency: 'INR',
                receipt: `sub_${Date.now()}`,
                notes: {
                    restaurantId: restaurantId.toString(),
                    planId: planId.toString(),
                    type: 'subscription_purchase'
                }
            });

            // Get Razorpay Key ID
            const credentials = await getRazorpayCredentials();
            const razorpayKeyId = credentials.keyId;

            res.status(200).json({
                success: true,
                data: {
                    razorpay: {
                        orderId: razorpayOrder.id,
                        amount: razorpayOrder.amount,
                        currency: razorpayOrder.currency,
                        key: razorpayKeyId
                    },
                    plan: plan
                },
            });
        } catch (razorpayError) {
            console.error("[Subscription] Razorpay order creation failed:", razorpayError);
            throw razorpayError;
        }

    } catch (error) {
        console.error("Error subscribing to plan:", error);
        res.status(500).json({
            success: false,
            message: "Failed to subscribe to plan",
        });
    }
};

/**
 * Get current subscription details
 */
export const getMySubscription = async (req, res) => {
    try {
        const restaurantId = req.user._id || req.user.id;
        const restaurant = await Restaurant.findById(restaurantId).populate("subscription.planId");

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
                message: "No active subscription"
            });
        }

        res.status(200).json({
            success: true,
            data: restaurant.subscription,
        });

    } catch (error) {
        console.error("Error fetching subscription:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch subscription details",
        });
    }
};

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
            // Optionally set status to 'cancelled' immediately or let it expire
            // restaurant.subscription.status = 'cancelled'; 
            await restaurant.save();
        }

        res.status(200).json({
            success: true,
            message: "Subscription auto-renewal cancelled. Plan remains active until end date.",
            data: restaurant.subscription
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
            isActive
        });

        res.status(201).json({
            success: true,
            data: plan,
            message: "Subscription plan created successfully"
        });
    } catch (error) {
        console.error("Error creating plan:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create subscription plan",
            error: error.message
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
            runValidators: true
        });

        if (!plan) {
            return res.status(404).json({
                success: false,
                message: "Subscription plan not found"
            });
        }

        res.status(200).json({
            success: true,
            data: plan,
            message: "Subscription plan updated successfully"
        });
    } catch (error) {
        console.error("Error updating plan:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update subscription plan",
            error: error.message
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
                message: "Subscription plan not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Subscription plan deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting plan:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete subscription plan",
            error: error.message
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
                message: "Subscription plan not found"
            });
        }

        plan.isActive = !plan.isActive;
        await plan.save();

        res.status(200).json({
            success: true,
            data: plan,
            message: `Plan ${plan.isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (error) {
        console.error("Error toggling plan status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update plan status",
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

        // Verify Razorpay signature
        const isSignatureValid = razorpayService.verifyPayment(
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

        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found",
            });
        }

        // Calculate amount
        let amount = 0;
        if (restaurant.zoneId) {
            const populatedRestaurant = await Restaurant.findById(restaurantId).populate({
                path: 'zoneId',
                populate: { path: 'tierId' }
            });
            if (populatedRestaurant.zoneId && populatedRestaurant.zoneId.tierId && populatedRestaurant.zoneId.tierId.rank) {
                const tierRank = populatedRestaurant.zoneId.tierId.rank;
                const tierKey = `tier${tierRank}`;
                amount = plan.pricing[tierKey] !== undefined ? plan.pricing[tierKey] : (plan.pricing?.tier1 || 0);
            } else {
                amount = plan.pricing?.tier1 || 0;
            }
        } else {
            amount = plan.pricing?.tier1 || 0;
        }

        // Create Payment record
        const payment = new Payment({
            paymentId: `PAY_SUB_${Date.now()}`,
            userId: restaurantId,
            amount: amount,
            currency: 'INR',
            method: 'razorpay',
            status: 'completed',
            razorpay: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                notes: {
                    restaurantId: restaurantId.toString(),
                    planId: planId.toString(),
                    type: 'subscription_purchase'
                }
            },
            completedAt: new Date()
        });
        await payment.save();

        // Activate subscription
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (plan.durationInDays || 30));

        restaurant.subscription = {
            planId: plan._id,
            startDate: startDate,
            endDate: endDate,
            status: "active",
            autoRenew: true,
            paymentId: razorpay_payment_id,
            features: plan.features,
        };
        restaurant.businessModel = "Subscription Base";
        await restaurant.save();

        res.status(200).json({
            success: true,
            message: "Subscription payment verified and activated successfully",
            data: {
                subscription: restaurant.subscription,
                paymentId: payment._id
            }
        });

    } catch (error) {
        console.error("Error verifying subscription payment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to verify subscription payment",
        });
    }
};
