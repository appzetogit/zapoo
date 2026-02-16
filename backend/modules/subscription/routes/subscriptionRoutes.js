
import express from "express";
import * as subscriptionController from "../controllers/subscriptionController.js";
// Assuming authMiddleware exists and verifies restaurant token/session
// Adjust path to authMiddleware as needed. Likely in shared/middlewares or modules/auth
import { authenticate, authorize, optionalAuthenticate } from "../../auth/middleware/auth.js";
import { authenticateAdmin } from "../../admin/middleware/adminAuth.js";

const router = express.Router();

// Public or Protected routes
// List plans - Optional auth to allow admins to see all plans
router.get("/plans", optionalAuthenticate, subscriptionController.getPlans);

// Restaurant routes
router.post("/subscribe", authenticate, authorize("restaurant"), subscriptionController.subscribe);
router.get("/my-subscription", authenticate, authorize("restaurant"), subscriptionController.getMySubscription);
router.post("/cancel", authenticate, authorize("restaurant"), subscriptionController.cancelSubscription);

// Admin routes
router.post("/plans", authenticateAdmin, subscriptionController.createPlan);
router.put("/plans/:id", authenticateAdmin, subscriptionController.updatePlan);
router.delete("/plans/:id", authenticateAdmin, subscriptionController.deletePlan);
router.patch("/plans/:id/toggle-status", authenticateAdmin, subscriptionController.togglePlanStatus);

export default router;
