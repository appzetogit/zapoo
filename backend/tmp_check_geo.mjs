import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import Restaurant from './modules/restaurant/models/Restaurant.js';
import Zone from './modules/admin/models/Zone.js';
import BusinessSettings from './modules/admin/models/BusinessSettings.js';

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI;
  if (!uri) {
    console.error('No MONGO_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const userLat = 22.6845065;
  const userLng = 75.8644601;
  const activeZones = await Zone.find({ isActive: true }).select('_id').lean();
  const activeZoneIds = activeZones.map(z => z._id);

  const query = {
    $and: [
      { isActive: true },
      {
        $or: [
          { businessModel: 'Commission Base' },
          {
            businessModel: { $ne: 'Commission Base' },
            'subscription.status': 'active',
            'subscription.endDate': { $gt: new Date() }
          }
        ]
      },
      {
        $or: [
          { zoneId: { $in: activeZoneIds } },
          { zoneId: { $exists: false } },
          { zoneId: null }
        ]
      }
    ]
  };

  const settings = await BusinessSettings.getSettings();
  const maxRangeMeters = (settings.maxDeliveryRange || 20) * 1000;

  const maxRangeAgg = await Restaurant.aggregate([
    { $match: query },
    { $group: { _id: null, maxRange: { $max: { $ifNull: ['$deliveryRange', 5] } } } }
  ]);
  const maxRangeKm = Number(maxRangeAgg?.[0]?.maxRange || 0);
  const maxRestaurantRangeMeters = Number.isFinite(maxRangeKm) && maxRangeKm > 0 ? maxRangeKm * 1000 : 0;
  const geoMaxMeters = Math.max(maxRangeMeters, maxRestaurantRangeMeters);

  const pipeline = [
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [userLng, userLat] },
        distanceField: 'distanceMeters',
        spherical: true,
        maxDistance: geoMaxMeters,
        query
      }
    },
    {
      $match: {
        $expr: {
          $lte: [
            '$distanceMeters',
            { $multiply: [{ $ifNull: ['$deliveryRange', 5] }, 1000] }
          ]
        }
      }
    },
    { $project: { name: 1, distanceMeters: 1, deliveryRange: 1, zoneId: 1 } }
  ];

  const results = await Restaurant.aggregate(pipeline);
  const found = results.find(r => String(r._id) === '69c10ab85b1270e55b91688b');
  console.log('total', results.length);
  console.log('found', found);

  await mongoose.disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
