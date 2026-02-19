
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Zone from "../modules/admin/models/Zone.js";

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

const debugZone = async () => {
    try {
        console.log("Attempting to create a zone...");
        const zoneData = {
            name: "Debug Zone",
            serviceLocation: "Debug City", // Changed from location to serviceLocation to match schema
            coordinates: [
                { latitude: 28.6139, longitude: 77.2090 },
                { latitude: 28.6448, longitude: 77.2167 },
                { latitude: 28.6448, longitude: 77.2410 },
                { latitude: 28.6139, longitude: 77.2410 }, // Closed loop not strictly required by my code but good practice
                { latitude: 28.6139, longitude: 77.2090 }
            ],
            country: "India",
            isActive: true
        };

        const zone = await Zone.create(zoneData);
        console.log("✅ Zone created:", zone);
        process.exit(0);
    } catch (error) {
        console.error("❌ Zone Creation Error:", error);
        if (error.errors) {
            for (const field in error.errors) {
                console.error(`  - ${field}: ${error.errors[field].message}`);
            }
        }
        process.exit(1);
    }
};

connectDB().then(debugZone);
