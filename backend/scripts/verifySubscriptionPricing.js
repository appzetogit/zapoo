import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPlans } from '../modules/subscription/controllers/subscriptionController.js';
import Restaurant from '../modules/restaurant/models/Restaurant.js';
import Zone from '../modules/admin/models/Zone.js';
import Tier from '../modules/admin/models/Tier.js';
import SubscriptionPlan from '../modules/admin/models/SubscriptionPlan.js';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.join(__dirname, '../.env')
});
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
const verifyPricing = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    // 1. Ensure we have Tiers 1-4
    const tiers = await Tier.find().sort({
      rank: 1
    });
    if (tiers.length < 4) {
      console.error("Not enough tiers seeded. Run seedTiers.js first.");
      // process.exit(1);
    }

    // 2. Ensure we have Subscription Plans
    const plans = await SubscriptionPlan.find();
    if (plans.length === 0) {
      console.error("No plans seeded. Run seedSubscriptionPlans.js first.");
      process.exit(1);
    }

    // Cleanup previous test data
    await Zone.deleteMany({
      name: /^Test Zone Tier/
    });
    await Restaurant.deleteMany({
      name: /^Test Restaurant Tier/
    });
    // 3. Find or Create a Restaurant for EACH Tier
    for (const tier of tiers) {
      // Find a zone with this tier
      let zone = await Zone.findOne({
        tierId: tier._id
      });
      if (!zone) {
        // Calculate coordinates to match target area
        const targetArea = (tier.minArea + tier.maxArea) / 2;
        const sideLengthKm = Math.sqrt(targetArea);
        const sideLengthDeg = sideLengthKm / 111; // Approx 111km per degree

        const coords = [[0, 0], [0, sideLengthDeg], [sideLengthDeg, sideLengthDeg], [sideLengthDeg, 0], [0, 0]].map(p => ({
          latitude: p[1],
          longitude: p[0]
        })); // Lat is Y, Long is X

        zone = await Zone.create({
          name: `Test Zone Tier ${tier.rank}`,
          coordinates: coords
          // tierId and area will be auto-calculated by pre-save hook
        });
      }

      // Find a restaurant in this zone
      let restaurant = await Restaurant.findOne({
        zoneId: zone._id
      });
      if (!restaurant) {
        restaurant = await Restaurant.create({
          name: `Test Restaurant Tier ${tier.rank}`,
          email: `test_tier_${tier.rank}@example.com`,
          phone: `999999990${tier.rank}`,
          ownerPhone: `999999990${tier.rank}`,
          ownerName: 'Test Owner',
          zoneId: zone._id,
          location: {
            latitude: 0,
            longitude: 0,
            address: 'Test Address'
          }
        });
      }

      // 4. Call getPlans with this restaurant
      const req = {
        user: {
          restaurantId: restaurant._id,
          role: 'restaurant'
        }
      };
      const res = mockRes();
      await getPlans(req, res);
      if (res.statusCode === 200 && res.data.success) {
        const fetchedPlans = res.data.data;
        fetchedPlans.forEach(plan => {
          // console.log(`Plan: ${plan.name}, Price Shown: ${plan.price}, Tier Name: ${plan.tierName}`);

          // Verify price matches tier price
          const expectedPrice = plan.pricing[`tier${tier.rank}`];
          if (plan.price === expectedPrice) {} else {
            console.error(`❌ ${plan.name}: Price ${plan.price} DOES NOT MATCH Tier ${tier.rank} price ${expectedPrice}!`);
          }
        });
      } else {
        console.error("Failed to fetch plans:", res.data);
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('Error verifying pricing:', error);
    process.exit(1);
  }
};
verifyPricing();