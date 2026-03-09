import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.join(__dirname, '../.env')
});
const API_URL = 'http://localhost:5000/api/admin';
const AUTH_URL = 'http://localhost:5000/api/admin/auth/login';

// Credentials - Replace with valid admin credentials if these don't work
const ADMIN_EMAIL = 'zapoo.startup@gmail.com';
const ADMIN_PASSWORD = 'Zapoo@2026';
async function runVerification() {
  try {
    // 1. Login

    let token;
    try {
      const loginRes = await axios.post(AUTH_URL, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      });
      token = loginRes.data.data.accessToken; // Adjust based on actual response structure
    } catch (err) {
      console.error('❌ Login failed:', err.response?.data || err.message);
      // Try creating admin if login fails? Or just exit
      process.exit(1);
    }
    const headers = {
      Authorization: `Bearer ${token}`
    };

    // 2. Create Tier

    const tierData = {
      name: "Test Tier 1",
      minArea: 0,
      maxArea: 10,
      description: "Small zone tier",
      rank: 1
    };
    let tierId;
    try {
      const createRes = await axios.post(`${API_URL}/tiers`, tierData, {
        headers
      });
      tierId = createRes.data.data._id;
    } catch (err) {
      if (err.response?.data?.message?.includes('already exists')) {
        const listRes = await axios.get(`${API_URL}/tiers`, {
          headers
        });
        const existing = listRes.data.data.find(t => t.rank === 1);
        tierId = existing._id;
      } else {
        console.error('❌ Create Tier failed:', err.response?.data || err.message);
        throw err;
      }
    }

    // 3. Create Zone (should be assigned to Tier 1)

    // Approx 4 sq km zone
    const smallZoneCoords = [{
      latitude: 28.6139,
      longitude: 77.2090
    },
    // New Delhi
    {
      latitude: 28.6139,
      longitude: 77.2290
    },
    // ~2km East
    {
      latitude: 28.6319,
      longitude: 77.2290
    },
    // ~2km North
    {
      latitude: 28.6319,
      longitude: 77.2090
    },
    // ~2km West
    {
      latitude: 28.6139,
      longitude: 77.2090
    } // Close loop
    ];
    const zoneData = {
      name: "Verification Zone",
      coordinates: smallZoneCoords,
      country: "India",
      serviceLocation: "Delhi"
    };
    let zoneId;
    try {
      const zoneRes = await axios.post(`${API_URL}/zones`, zoneData, {
        headers
      });
      const zone = zoneRes.data.data;
      zoneId = zone._id;
      if (zone.tierId === tierId) {} else {
        console.error(`❌ Auto-assignment failed! Expected ${tierId}, got ${zone.tierId}`);
      }
    } catch (err) {
      console.error('❌ Create Zone failed:', err.response?.data || err.message);
      // It might fail if I don't have permission or if zone validation fails
    }

    // 4. Test getRestaurantsByZone
    if (zoneId) {
      try {
        const restRes = await axios.get(`${API_URL}/tiers/zones/${zoneId}/restaurants?filter=average`, {
          headers
        });
        if (restRes.data.data.restaurants.length > 0) {}
      } catch (err) {
        console.error('❌ Get Restaurants failed:', err.response?.data || err.message);
      }

      // Cleanup Zone

      await axios.delete(`${API_URL}/zones/${zoneId}`, {
        headers
      });
    }

    // Cleanup Tier

    await axios.delete(`${API_URL}/tiers/${tierId}`, {
      headers
    });
  } catch (error) {
    console.error('❌ Verification script failed:', error.message);
  }
}
runVerification();