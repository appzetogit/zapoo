import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tier from '../modules/admin/models/Tier.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('MONGO_URI/MONGODB_URI is required');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(MONGO_URI);
  try {
    const result = await Tier.updateMany(
      {
        $or: [
          { 'deliveryPricing.adminRetentionPercent': { $exists: false } },
          { 'deliveryPricing.adminRetentionPercent': null }
        ]
      },
      {
        $set: { 'deliveryPricing.adminRetentionPercent': 0 }
      }
    );

    console.log('Backfill completed');
    console.log(`Matched: ${result.matchedCount || 0}`);
    console.log(`Modified: ${result.modifiedCount || 0}`);
  } finally {
    await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('Backfill failed:', error.message);
  process.exit(1);
});
