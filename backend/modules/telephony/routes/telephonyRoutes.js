import express from "express";
import {
  initiateCall,
  handleExotelCallback,
  handleIncomingCallPassthru,
  getVirtualNumbers,
} from "../controllers/callController.js";

const router = express.Router();

router.post("/api/telephony/call", initiateCall);
router.post("/api/telephony/exotel-callback", handleExotelCallback);
router.post("/api/telephony/passthru", handleIncomingCallPassthru);
router.get("/api/telephony/passthru", handleIncomingCallPassthru);
router.get("/api/telephony/virtual-numbers", getVirtualNumbers);

export default router;

