import express from "express";
import { getAvailableTables, bookTable } from "../controllers/reservationController.js";
import { authenticate } from "../../auth/middleware/auth.js";

const router = express.Router();

router.get("/available-tables", getAvailableTables);
router.post("/book-table", authenticate, bookTable);

export default router;
