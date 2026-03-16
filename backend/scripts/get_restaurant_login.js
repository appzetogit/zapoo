import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Restaurant from "../modules/restaurant/models/Restaurant.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function getRestaurantLogin() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const restaurant = await Restaurant.findOne({ name: "Spicy Delhi Bites" });
  if (restaurant) {
    console.log("Restaurant Login info:");
    console.log("Name:", restaurant.name);
    console.log("Email:", restaurant.email);
    console.log("Phone:", restaurant.phone);
  } else {
    console.log("Restaurant not found.");
  }

  await mongoose.disconnect();
}

getRestaurantLogin().catch(console.error);
