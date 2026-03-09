import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Tier from '../modules/admin/models/Tier.js';
dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});
const tiers = [{
  name: 'Small',
  minArea: 0,
  maxArea: 10,
  rank: 1,
  description: 'Compact zones (0-10 km²)'
}, {
  name: 'Medium',
  minArea: 10,
  maxArea: 25,
  rank: 2,
  description: 'Standard city zones (10-25 km²)'
}, {
  name: 'Large',
  minArea: 25,
  maxArea: 50,
  rank: 3,
  description: 'Extended metropolitan areas (25-50 km²)'
}, {
  name: 'Extra Large',
  minArea: 50,
  maxArea: 500,
  rank: 4,
  description: 'Regional or vast zones (50+ km²)'
}];
const seedTiers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    for (const tierData of tiers) {
      await Tier.findOneAndUpdate({
        rank: tierData.rank
      }, tierData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      });
    }
    process.exit(0);
  } catch (error) {
    console.error('Error seeding tiers:', error);
    process.exit(1);
  }
};
seedTiers();