
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Zone from "../modules/admin/models/Zone.js";
import Restaurant from "../modules/restaurant/models/Restaurant.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1);
    }
};

const verifyData = async () => {
    try {
        console.log("Verifying seeded data...");

        const zones = await Zone.find({ isActive: true });
        console.log(`✅ Found ${zones.length} active zones.`);
        zones.forEach(z => console.log(`  - ${z.name} (${z._id})`));

        const restaurants = await Restaurant.find({ isActive: true });
        console.log(`✅ Found ${restaurants.length} active restaurants.`);
        restaurants.forEach(r => console.log(`  - ${r.name} (Zone: ${r.zoneId})`));

        if (zones.length >= 3 && restaurants.length >= 3) {
            console.log("✅ Verification PASSED: Sufficient data found.");
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
