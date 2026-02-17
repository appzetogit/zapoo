
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://localhost:5000/api/admin';
const AUTH_URL = 'http://localhost:5000/api/admin/auth/login';

// Credentials - Replace with valid admin credentials if these don't work
const ADMIN_EMAIL = 'zapoo.startup@gmail.com';
const ADMIN_PASSWORD = 'Zapoo@2026';

async function runVerification() {
    try {
        console.log('🔄 Starting Tier System Verification...');

        // 1. Login
        console.log('🔑 Logging in...');
        let token;
        try {
            const loginRes = await axios.post(AUTH_URL, {
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD
            });
            token = loginRes.data.data.accessToken; // Adjust based on actual response structure
            console.log('✅ Login successful');
        } catch (err) {
            console.error('❌ Login failed:', err.response?.data || err.message);
            // Try creating admin if login fails? Or just exit
            process.exit(1);
        }

        const headers = { Authorization: `Bearer ${token}` };

        // 2. Create Tier
        console.log('\n➕ Creating Test Tier...');
        const tierData = {
            name: "Test Tier 1",
            minArea: 0,
            maxArea: 10,
            description: "Small zone tier",
            rank: 1
        };

        let tierId;
        try {
            const createRes = await axios.post(`${API_URL}/tiers`, tierData, { headers });
            console.log('✅ Tier created:', createRes.data.data.name);
            tierId = createRes.data.data._id;
        } catch (err) {
            if (err.response?.data?.message?.includes('already exists')) {
                console.log('⚠️ Tier already exists, fetching...');
                const listRes = await axios.get(`${API_URL}/tiers`, { headers });
                const existing = listRes.data.data.find(t => t.rank === 1);
                tierId = existing._id;
                console.log('✅ Used existing tier:', existing.name);
            } else {
                console.error('❌ Create Tier failed:', err.response?.data || err.message);
                throw err;
            }
        }

        // 3. Create Zone (should be assigned to Tier 1)
        console.log('\n🗺️ Creating Small Zone (should be Tier 1)...');
        // Approx 4 sq km zone
        const smallZoneCoords = [
            { latitude: 28.6139, longitude: 77.2090 }, // New Delhi
            { latitude: 28.6139, longitude: 77.2290 }, // ~2km East
            { latitude: 28.6319, longitude: 77.2290 }, // ~2km North
            { latitude: 28.6319, longitude: 77.2090 }, // ~2km West
            { latitude: 28.6139, longitude: 77.2090 }  // Close loop
        ];

        const zoneData = {
            name: "Verification Zone",
            coordinates: smallZoneCoords,
            country: "India",
            serviceLocation: "Delhi"
        };

        let zoneId;
        try {
            const zoneRes = await axios.post(`${API_URL}/zones`, zoneData, { headers });
            const zone = zoneRes.data.data;
            console.log(`✅ Zone created. Area: ${zone.area} km². Tier ID: ${zone.tierId}`);
            zoneId = zone._id;

            if (zone.tierId === tierId) {
                console.log('✅ Auto-assignment verified: Zone assigned to correct Tier');
            } else {
                console.error(`❌ Auto-assignment failed! Expected ${tierId}, got ${zone.tierId}`);
            }

        } catch (err) {
            console.error('❌ Create Zone failed:', err.response?.data || err.message);
            // It might fail if I don't have permission or if zone validation fails
        }

        // 4. Test getRestaurantsByZone
        if (zoneId) {
            console.log('\n🍽️ Testing Get Resturants by Zone...');
            try {
                const restRes = await axios.get(`${API_URL}/tiers/zones/${zoneId}/restaurants?filter=average`, { headers });
                console.log(`✅ Fetched ${restRes.data.data.restaurants.length} restaurants from zone`);
                if (restRes.data.data.restaurants.length > 0) {
                    console.log('Sample metrics:', restRes.data.data.restaurants[0].metrics);
                }
            } catch (err) {
                console.error('❌ Get Restaurants failed:', err.response?.data || err.message);
            }

            // Cleanup Zone
            console.log('\n🧹 Cleaning up Zone...');
            await axios.delete(`${API_URL}/zones/${zoneId}`, { headers });
        }

        // Cleanup Tier
        console.log('🧹 Cleaning up Tier...');
        await axios.delete(`${API_URL}/tiers/${tierId}`, { headers });
        console.log('✅ Verification Completed');

    } catch (error) {
        console.error('❌ Verification script failed:', error.message);
    }
}

runVerification();
