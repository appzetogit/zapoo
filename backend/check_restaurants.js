import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const restaurantSchema = new mongoose.Schema({
    name: String,
    email: String,
    isActive: Boolean
}, { collection: 'restaurants' });

const Restaurant = mongoose.model('Restaurant', restaurantSchema);

async function checkRestaurants() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const restaurants = await Restaurant.find({});
        console.log('Total restaurants:', restaurants.length);

        restaurants.forEach((r, i) => {
            console.log(`[${i}] Name: ${r.name}, Email: ${r.email}, isActive: ${r.isActive}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkRestaurants();
