import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Zone from './modules/admin/models/Zone.js';
import Tier from './modules/admin/models/Tier.js';
import { createTier, updateTier, deleteTier } from './modules/admin/controllers/tierController.js';
dotenv.config();
const mockRes = {
  status: function (s) {
    this.statusCode = s;
    return this;
  },
  json: function (data) {
    this.data = data;
    return this;
  }
};
async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await Zone.deleteMany({
    name: /^TestZone_/
  });
  await Tier.deleteMany({
    name: /^TestTier_/
  });

  // Use very high area ranges to avoid overlapping existing DB tiers.

  let req1 = {
    body: {
      name: 'TestTier_1',
      rank: 9991,
      minArea: 9000,
      maxArea: 9015
    }
  };
  await createTier(req1, mockRes);
  let req2 = {
    body: {
      name: 'TestTier_2',
      rank: 9992,
      minArea: 9010,
      maxArea: 9030
    }
  };
  await createTier(req2, mockRes);
  let req3 = {
    body: {
      name: 'TestTier_3',
      rank: 9993,
      minArea: 9015,
      maxArea: 9030
    }
  };
  await createTier(req3, mockRes);
  // 0.3 degree is ~33km, 33x33 = ~1100 sq km
  // 1 degree is ~111km. 0.85 degree sq is roughly 9000 sq km
  let zone1 = new Zone({
    name: 'TestZone_A',
    country: 'India',
    coordinates: [{
      latitude: 12.0,
      longitude: 77.0
    }, {
      latitude: 12.85,
      longitude: 77.0
    }, {
      latitude: 12.85,
      longitude: 77.85
    }, {
      latitude: 12.0,
      longitude: 77.85
    }, {
      latitude: 12.0,
      longitude: 77.0
    }]
  });
  try {
    await zone1.save();
  } catch (e) {}

  // Very large zone => orphan
  let zone2 = new Zone({
    name: 'TestZone_B',
    country: 'India',
    coordinates: [{
      latitude: 12.0,
      longitude: 77.0
    }, {
      latitude: 14.1,
      longitude: 77.0
    }, {
      latitude: 14.1,
      longitude: 79.1
    }, {
      latitude: 12.0,
      longitude: 79.1
    }, {
      latitude: 12.0,
      longitude: 77.0
    }]
  });
  try {
    await zone2.save();
  } catch (e) {}
  const tier1 = await Tier.findOne({
    name: 'TestTier_1'
  });
  const tier3 = await Tier.findOne({
    name: 'TestTier_3'
  });

  // Update tier 1 so that zone1 becomes an orphan (if zone1 area is around ~9010)
  // Let's ensure zone1 is smaller than 9015.
  // We'll update tier1 to maxArea: 5. Then if zone1 > 5, it will be orphaned.
  let reqUpdate = {
    params: {
      id: tier1._id.toString()
    },
    body: {
      maxArea: 50,
      minArea: 0
    }
  };
  await updateTier(reqUpdate, mockRes);
  // Extend Tier 3 to cover everything
  let reqUpdate3 = {
    params: {
      id: tier3._id.toString()
    },
    body: {
      minArea: 0,
      maxArea: 10000
    }
  };
  await updateTier(reqUpdate3, mockRes);
  // Now Tier 1 update should succeed
  await updateTier(reqUpdate, mockRes);
  const updatedZone1 = await Zone.findById(zone1._id);
  let reqDelete = {
    params: {
      id: tier3._id.toString()
    }
  };
  await deleteTier(reqDelete, mockRes);
  await Zone.deleteMany({
    name: /^TestZone_/
  });
  await Tier.deleteMany({
    name: /^TestTier_/
  });
  mongoose.disconnect();
}
runTests();