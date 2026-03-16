import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Restaurant from "../modules/restaurant/models/Restaurant.js";
import Admin from "../modules/admin/models/Admin.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkData() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const admin = await Admin.findOne({ role: "admin" });
  const restaurant = await Restaurant.findOne();
  
  console.log("Found Admin:", admin ? { id: admin._id, name: admin.name } : "None");
  console.log("Found Restaurant:", restaurant ? { id: restaurant._id, name: restaurant.name, rm: restaurant.relationshipManager } : "None");
  
  if (admin && restaurant && !restaurant.relationshipManager) {
    restaurant.relationshipManager = admin._id;
    await restaurant.save();
    console.log(`✅ Assigned RM ${admin.name} to restaurant ${restaurant.name}`);
  } else if (admin && restaurant && restaurant.relationshipManager) {
    console.log(`ℹ️ Restaurant ${restaurant.name} already has an RM assigned.`);
  }

  await mongoose.disconnect();
}

checkData().catch(console.error);
