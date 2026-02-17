import mongoose from "mongoose";
import dotenv from "dotenv";
import EnvironmentVariable from "../modules/admin/models/EnvironmentVariable.js";

dotenv.config();

const updateCredentials = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    console.log("🔍 Fetching Environment Variables...");
    const envVars = await EnvironmentVariable.getOrCreate();

    console.log("📝 Updating Cloudinary Credentials...");
    // Values provided by user
    envVars.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dlttlwzlm";
    envVars.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "381417573627185";
    envVars.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "d44IgZkvbxfU9fZ_I2idx9_Kc7Y";

    await envVars.save();
    console.log("✅ Cloudinary Credentials updated successfully!");
  } catch (error) {
    console.error("❌ Error updating credentials:", error);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
    process.exit();
  }
};

updateCredentials();
