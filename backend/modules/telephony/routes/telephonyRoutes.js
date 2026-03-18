import express from "express";
import {
  initiateCall,
  handleExotelCallback,
} from "../controllers/callController.js";

const router = express.Router();

router.post("/api/telephony/call", initiateCall);
router.post("/api/telephony/exotel-callback", handleExotelCallback);

export default router;

