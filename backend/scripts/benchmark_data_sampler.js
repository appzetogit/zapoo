import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';

// Models
import Order from '../modules/order/models/Order.js';
import Restaurant from '../modules/restaurant/models/Restaurant.js';
import Delivery from '../modules/delivery/models/Delivery.js';
import User from '../modules/auth/models/User.js';
import Admin from '../modules/admin/models/Admin.js';
// Add others if needed (Address, Category, Menu etc)

dotenv.config();

async function sampleData() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB for sampling...');

    const samples = {
        id: [],
        orderId: [],
        restaurantId: [],
        riderId: [],
        userId: [],
        role: ['user', 'restaurant', 'delivery', 'admin'],
        day: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    };

    try {
        // Sample Orders
        const orders = await Order.find({}).limit(5).select('_id orderId').lean();
        samples.orderId = orders.map(o => o._id.toString());

        // Sample Restaurants
        const restaurants = await Restaurant.find({ isActive: true }).limit(5).select('_id').lean();
        samples.restaurantId = restaurants.map(r => r._id.toString());

        // Sample Users
        const users = await User.find({}).limit(5).select('_id').lean();
        samples.userId = users.map(u => u._id.toString());

        // Sample Delivery Boys
        const riders = await Delivery.find({}).limit(5).select('_id').lean();
        samples.riderId = riders.map(r => r._id.toString());

        // Generic :id map (use restaurant or user as backup)
        samples.id = [...samples.restaurantId, ...samples.userId];

        // Find any Address ID for a user
        // (Assuming User model or separate Address model)
        // For now, let's keep it simple and add more as we hit batches

        console.log('✅ Data sampling complete.');
        fs.writeFileSync('benchmark_samples.json', JSON.stringify(samples, null, 2));
        console.log('Samples saved to benchmark_samples.json');

    } catch (err) {
        console.error('❌ Data sampling failed:', err);
    } finally {
        process.exit(0);
    }
}

sampleData();
