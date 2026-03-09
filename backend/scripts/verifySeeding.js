import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Zone from "../modules/admin/models/Zone.js";
import Restaurant from "../modules/restaurant/models/Restaurant.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.join(__dirname, "../.env")
});
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  }
};
const verifyData = async () => {
  try {
    const zones = await Zone.find({
      isActive: true
    });
    zones.forEach(z => {});
    const restaurants = await Restaurant.find({
      isActive: true
    });
    restaurants.forEach(r => {});
    if (zones.length >= 3 && restaurants.length >= 3) {
      process.exit(0);
    } else {
      console.error("❌ Verification FAILED: Insufficient data.");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Verification Error:", error);
    process.exit(1);
  }
};
connectDB().then(verifyData);