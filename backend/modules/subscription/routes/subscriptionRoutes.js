
import express from "express";
import * as subscriptionController from "../controllers/subscriptionController.js";
import { optionalAuthenticate } from "../../auth/middleware/auth.js";
import { authenticate as authenticateRestaurant } from "../../restaurant/middleware/restaurantAuth.js";
import { checkFeatureAccess } from "../../restaurant/middleware/subscriptionGuard.js";
import { authenticateAdmin } from "../../admin/middleware/adminAuth.js";

const router = express.Router();

// Public or Protected routes
// List plans - Optional auth to allow admins to see all plans
router.get("/plans", optionalAuthenticate, subscriptionController.getPlans);
router.get("/my-plan", authenticateRestaurant, subscriptionController.getMyPlan);

// Restaurant routes
router.post("/subscribe", authenticateRestaurant, subscriptionController.subscribe);
router.post("/claim-trial", authenticateRestaurant, subscriptionController.claimTrial);
router.post("/create-order", authenticateRestaurant, subscriptionController.createSubscriptionOrder);
router.post("/verify-payment", authenticateRestaurant, subscriptionController.verifySubscriptionPayment);
router.get("/my-subscription", authenticateRestaurant, subscriptionController.getMySubscription);
router.post("/cancel", authenticateRestaurant, subscriptionController.cancelSubscription);
router.post("/request-rm-call", authenticateRestaurant, checkFeatureAccess("relationship_manager"), subscriptionController.requestRMCallViaSubscription);
router.get("/history", authenticateRestaurant, checkFeatureAccess("relationship_manager"), subscriptionController.getRMCallHistoryViaSubscription);

// Admin routes
router.post("/plans", authenticateAdmin, subscriptionController.createPlan);
router.put("/plans/:id", authenticateAdmin, subscriptionController.updatePlan);
router.delete("/plans/:id", authenticateAdmin, subscriptionController.deletePlan);
router.patch("/plans/:id/toggle-status", authenticateAdmin, subscriptionController.togglePlanStatus);
router.patch("/plans/update-price", authenticateAdmin, subscriptionController.updatePlanPrice);
router.get("/restaurants", authenticateAdmin, subscriptionController.getRestaurantSubscriptions);

export default router;
