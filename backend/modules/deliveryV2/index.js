import express from "express";
import deliveryRouter from "../delivery/index.js";

const router = express.Router();

// Safe adapter mount:
// Reuse stable delivery module under /api/delivery-v2 until native deliveryV2
// controllers/services are fully migrated to current zapoo architecture.
router.use("/", deliveryRouter);

export default router;
