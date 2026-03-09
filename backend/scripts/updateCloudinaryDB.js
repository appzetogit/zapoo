import mongoose from "mongoose";
import dotenv from "dotenv";
import EnvironmentVariable from "../modules/admin/models/EnvironmentVariable.js";
dotenv.config();
const updateCredentials = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const envVars = await EnvironmentVariable.getOrCreate();
    // Values provided by user
    envVars.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dlttlwzlm";
    envVars.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "381417573627185";
    envVars.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "d44IgZkvbxfU9fZ_I2idx9_Kc7Y";
    await envVars.save();
  } catch (error) {
    console.error("❌ Error updating credentials:", error);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
};
updateCredentials();