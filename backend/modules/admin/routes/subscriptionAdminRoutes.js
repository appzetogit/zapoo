import express from "express";
import { authenticateAdmin } from "../middleware/adminAuth.js";
import * as subscriptionController from "../../subscription/controllers/subscriptionController.js";

const router = express.Router();

router.use(authenticateAdmin);

router.get("/plans", subscriptionController.getPlans);
router.post("/create-plan", subscriptionController.createPlan);
router.patch("/update-price", subscriptionController.updatePlanPrice);
router.patch("/toggle-plan", async (req, res) => {
  if (!req.body?.planId) {
    return res.status(400).json({
      success: false,
      message: "planId is required",
    });
  }
  req.params.id = req.body.planId;
  return subscriptionController.togglePlanStatus(req, res);
});
router.get("/restaurants", subscriptionController.getRestaurantSubscriptions);

export default router;
