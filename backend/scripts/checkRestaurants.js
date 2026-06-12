import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Restaurant from '../modules/restaurant/models/Restaurant.js';

dotenv.config();
const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;

async function run() {
  await mongoose.connect(uri);
  const restaurants = await Restaurant.find({}).lean();
  console.log(`Total restaurants in DB: ${restaurants.length}`);
  restaurants.forEach((r, idx) => {
    console.log(`${idx + 1}. Name: ${r.name}, isActive: ${r.isActive}, approvedAt: ${r.approvedAt}, completedSteps: ${r.onboarding?.completedSteps}`);
  });
  await mongoose.disconnect();
}

run().catch(console.error);
