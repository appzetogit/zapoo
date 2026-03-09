import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Admin from "../modules/admin/models/Admin.js";

// Setup environment
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
const createCustomAdmin = async () => {
  try {
    const adminCredentials = {
      email: "zapoo.startup@gmail.com",
      password: "Zapoo@2026"
      // OPT/OTP provided: 110211 - Not stored in DB as per schema, potentially for 2FA or verification if implemented later.
      // For now, we just create the user.
    };

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({
      email: adminCredentials.email.toLowerCase()
    });
    if (existingAdmin) {
      // Optional: Update password if needed
      existingAdmin.password = adminCredentials.password;
      await existingAdmin.save();
      process.exit(0);
    }
    const newAdmin = await Admin.create({
      name: "Ajay Panchal",
      // Inferring name from email, can be generic
      email: adminCredentials.email,
      password: adminCredentials.password,
      role: "admin",
      isActive: true,
      phoneVerified: true,
      // Assuming verified since credentials are provided
      permissions: ['dashboard_view', 'admin_manage', 'restaurant_manage', 'delivery_manage', 'order_manage', 'user_manage', 'report_view', 'settings_manage', 'payment_manage', 'campaign_manage']
    });
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating admin DETAILS:", error);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
};
connectDB().then(() => {
  createCustomAdmin();
});