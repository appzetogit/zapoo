import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Tier from '../modules/admin/models/Tier.js';
import Zone from '../modules/admin/models/Zone.js';

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrate = async () => {
  try {
    dotenv.config({
      path: path.join(__dirname, '../.env')
    });
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in .env file');
    }
    await mongoose.connect(process.env.MONGODB_URI);

    // 1. Migrate Tiers

    const tiers = await Tier.find({});
    for (const tier of tiers) {
      let updated = false;
      if (!tier.deliveryPricing || typeof tier.deliveryPricing.baseFee !== 'number') {
        tier.deliveryPricing = {
          baseFee: 0,
          freeDeliveryThreshold: 0
        };
        updated = true;
      }
      if (updated) {
        await tier.save();
      }
    }

    // 2. Migrate Zones

    const zones = await Zone.find({}); // Fetch all zones

    // Pre-fetch all tiers for quick lookup
    const tierMap = {};
    (await Tier.find({})).forEach(t => {
      tierMap[t._id.toString()] = t;
    });
    for (const zone of zones) {
      let needsUpdate = false;

      // Initialize deliveryPricing if missing
      if (!zone.deliveryPricing || typeof zone.deliveryPricing.baseFee !== 'number') {
        // If linked to a Tier, inherit
        if (zone.tierId && tierMap[zone.tierId.toString()]) {
          const tier = tierMap[zone.tierId.toString()];
          zone.deliveryPricing = {
            baseFee: tier.deliveryPricing?.baseFee || 0,
            freeDeliveryThreshold: tier.deliveryPricing?.freeDeliveryThreshold || 0,
            isOverridden: false,
            lastUpdated: new Date()
          };
        } else {
          // Default values
          zone.deliveryPricing = {
            baseFee: 0,
            freeDeliveryThreshold: 0,
            isOverridden: false,
            lastUpdated: new Date()
          };
        }
        needsUpdate = true;
      }
      if (needsUpdate) {
        await zone.save();
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
};
migrate();