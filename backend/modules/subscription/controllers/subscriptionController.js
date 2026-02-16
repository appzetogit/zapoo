
import SubscriptionPlan from "../../admin/models/SubscriptionPlan.js";
import Restaurant from "../../restaurant/models/Restaurant.js";
import Payment from "../../payment/models/Payment.js"; // Assuming Payment model exists
import mongoose from "mongoose";

/**
 * Get all active subscription plans
 */
export const getPlans = async (req, res) => {
    try {
        let query = { isActive: true };

        // If admin is requesting, return all plans
        // Check for req.admin (set by authenticateAdmin) or req.user.role === 'admin'
        if ((req.admin) || (req.user && req.user.role === 'admin')) {
            query = {};
        }

        const plans = await SubscriptionPlan.find(query).lean();

        // Check if request is from a logged-in restaurant to apply zone pricing
        if (req.user && (req.user.restaurantId || req.user.role === 'restaurant')) {
            try {
                const restaurantId = req.user.restaurantId || req.user.id;
                const restaurant = await Restaurant.findById(restaurantId).select('zoneId');

                if (restaurant && restaurant.zoneId) {
                    // Adjust prices based on zone
                    plans.forEach(plan => {
                        if (plan.zonePricing && plan.zonePricing.length > 0) {
                            const zonePrice = plan.zonePricing.find(zp => zp.zoneId.toString() === restaurant.zoneId.toString());
                            if (zonePrice) {
                                plan.price = zonePrice.price;
                                plan.originalPrice = zonePrice.price; // For UI reference if needed
                            }
                        }
                    });
                }
            } catch (err) {
                console.error("Error applying zone pricing:", err);
                // Continue with base prices if error occurs
            }
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
        const { planId, paymentMethod = 'razorpay' } = req.body;
        const restaurantId = req.user.restaurantId || req.user.id; // Assuming auth middleware sets this

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

        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found",
            });
        }

        // Logic to handle payment would go here.
        // For now, we assume payment is successful or handled via a separate flow initiating here.
        // If it's a paid plan, we should initiate a payment gateway transaction.
        // For MVP/Demo, we might auto-activate or require a transaction ID.

        // Let's assume we just activate it for now (Free Tier or Mock Payment)
        // In a real scenario, this would likely return a payment intent, and a webhook would activate the subscription.

        // Calculate end date
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + (plan.durationInDays || 30));

        // Update restaurant subscription
        restaurant.subscription = {
            planId: plan._id,
            startDate: startDate,
            endDate: endDate,
            status: "active",
            autoRenew: true,
            paymentId: "MOCK_PAYMENT_" + Date.now(), // Placeholder
            features: plan.features,
        };

        restaurant.businessModel = "Subscription Base";

        await restaurant.save();

        res.status(200).json({
            success: true,
            message: "Subscription activated successfully",
            data: {
                subscription: restaurant.subscription,
                plan: plan
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
 * Get current subscription details
 */
export const getMySubscription = async (req, res) => {
    try {
        const restaurantId = req.user.restaurantId || req.user.id;
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
        const restaurantId = req.user.restaurantId || req.user.id;
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
        const { name, price, durationInDays, features, isActive } = req.body;

        const plan = await SubscriptionPlan.create({
            name,
            price,
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
