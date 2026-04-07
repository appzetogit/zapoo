import express from "express";
import jwt from "jsonwebtoken";
import {
  initiateBridgeCall,
  handleExotelCallback,
  handleIncomingCallPassthru,
  getVirtualNumbers,
} from "../controllers/callController.js";
import { authenticate as authenticateUser } from "../../auth/middleware/auth.js";
import { authenticate as authenticateRestaurant } from "../../restaurant/middleware/restaurantAuth.js";
import { authenticate as authenticateDelivery } from "../../delivery/middleware/deliveryAuth.js";

const router = express.Router();

const authenticateAny = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.decode(token);

    if (!decoded?.role) {
      return res.status(401).json({ success: false, message: "Invalid token structure" });
    }

    if (decoded.role === "restaurant") {
      return authenticateRestaurant(req, res, next);
    }

    if (decoded.role === "delivery") {
      return authenticateDelivery(req, res, next);
    }

    if (decoded.role === "user") {
      return authenticateUser(req, res, next);
    }

    return res.status(403).json({ success: false, message: "Unauthorized role" });
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

router.post("/api/telephony/call", authenticateAny, initiateBridgeCall);
router.post("/api/telephony/exotel-callback", handleExotelCallback);
router.post("/api/telephony/passthru", handleIncomingCallPassthru);
router.get("/api/telephony/passthru", handleIncomingCallPassthru);
router.get("/api/telephony/virtual-numbers", getVirtualNumbers);

export default router;

