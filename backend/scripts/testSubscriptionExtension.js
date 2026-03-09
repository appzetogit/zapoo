import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { extendRestaurantSubscription } from "../modules/admin/controllers/adminController.js";
import Restaurant from "../modules/restaurant/models/Restaurant.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.join(__dirname, "../.env")
});
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};
const mockRes = () => {
  const res = {};
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.json = data => {
    res.data = data;
    return res;
  };
  return res;
};
const runTest = async () => {
  await connectDB();
  try {
    // 1. Create a test restaurant
    const testRestaurant = await Restaurant.create({
      name: "Test Subscription Resto",
      email: `test_sub_${Date.now()}@example.com`,
      password: "pword",
      phone: `999${Date.now().toString().slice(-7)}`,
      ownerName: "Test Owner",
      ownerPhone: `888${Date.now().toString().slice(-7)}`,
      address: "Test Address",
      location: {
        coordinates: [77.5946, 12.9716],
        addressLine1: "Test St"
      },
      subscription: {
        status: "inactive",
        endDate: new Date(Date.now() - 86400000) // Yesterday
      }
    });

    // 2. Test Invalid Days

    const reqInvalid = {
      params: {
        id: testRestaurant._id
      },
      body: {
        days: -5
      },
      user: {
        _id: "admin_id"
      }
    };
    const resInvalid = mockRes();
    await extendRestaurantSubscription(reqInvalid, resInvalid, err => {});

    // 3. Test Valid Extension (expired to active)

    const reqValid = {
      params: {
        id: testRestaurant._id
      },
      body: {
        days: 30
      },
      user: {
        _id: "admin_id"
      }
    };
    const resValid = mockRes();
    await extendRestaurantSubscription(reqValid, resValid, err => {});
    // Verify in DB
    const updatedRest = await Restaurant.findById(testRestaurant._id);

    // 4. Test Valid Extension (Active + 30 days)

    const currentEnd = new Date(updatedRest.subscription.endDate);
    const reqExtend = {
      params: {
        id: testRestaurant._id
      },
      body: {
        days: 30
      },
      user: {
        _id: "admin_id"
      }
    };
    const resExtend = mockRes();
    await extendRestaurantSubscription(reqExtend, resExtend, err => {});
    const extendedRest = await Restaurant.findById(testRestaurant._id);
    // Calculate difference in days roughly
    const diffTime = Math.abs(extendedRest.subscription.endDate - currentEnd);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Should be 30

    // Cleanup
    await Restaurant.findByIdAndDelete(testRestaurant._id);
  } catch (error) {
    console.error("Test failed:", error);
  } finally {
    await mongoose.disconnect();
  }
};
runTest();