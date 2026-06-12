import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { getDashboardStats, getRestaurants, getRestaurantJoinRequests } from '../modules/admin/controllers/adminController.js';

dotenv.config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;

const makeMockRes = (resolve) => ({
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    resolve({ statusCode: this.statusCode || 200, data });
  }
});

async function run() {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Test getDashboardStats
  const statsResult = await new Promise((resolve) => {
    const req = { query: {} };
    const res = makeMockRes(resolve);
    getDashboardStats(req, res, (err) => {
      console.error('Error in getDashboardStats:', err);
      resolve(null);
    });
  });
  console.log('Dashboard Stats - Total Approved Restaurants:', statsResult.data.data.restaurants.total);
  console.log('Dashboard Stats - Pending Requests:', statsResult.data.data.restaurants.pendingRequests);

  // Test getRestaurants (default / no query params)
  const listResult = await new Promise((resolve) => {
    const req = { query: {} };
    const res = makeMockRes(resolve);
    getRestaurants(req, res, (err) => {
      console.error('Error in getRestaurants:', err);
      resolve(null);
    });
  });
  console.log('List Restaurants - Default count returned:', listResult.data.data.restaurants.length);

  // Test getRestaurantJoinRequests
  const joinResult = await new Promise((resolve) => {
    const req = { query: { status: 'pending' } };
    const res = makeMockRes(resolve);
    getRestaurantJoinRequests(req, res, (err) => {
      console.error('Error in getRestaurantJoinRequests:', err);
      resolve(null);
    });
  });
  console.log('Join Requests - Count returned:', joinResult.data.data.restaurants.length);

  await mongoose.disconnect();
}

run().catch(console.error);
