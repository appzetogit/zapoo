import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import SubscriptionPlan from './modules/admin/models/SubscriptionPlan.js';
import Restaurant from './modules/restaurant/models/Restaurant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const plans = await SubscriptionPlan.find({});
        console.log('Plans found:', plans.length);
        plans.forEach(p => console.log(`- ${p.name} (${p.isActive ? 'Active' : 'Inactive'})`));

        const restaurants = await Restaurant.find({ "subscription.status": "active" });
        console.log('Restaurants with active subscription:', restaurants.length);
        restaurants.forEach(r => console.log(`- ${r.name} (Active: ${r.isActive})`));

        const activeRestaurants = await Restaurant.find({ "subscription.status": "active", isActive: true });
        console.log('Restaurants with active subscription AND isActive=true:', activeRestaurants.length);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkData();
