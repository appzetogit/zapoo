import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../modules/auth/models/User.js';
import Admin from '../modules/admin/models/Admin.js';
import Restaurant from '../modules/restaurant/models/Restaurant.js';
import Delivery from '../modules/delivery/models/Delivery.js';
import fs from 'fs';

dotenv.config();

const generateToken = (userId, role) => {
    return jwt.sign(
        { userId, role, type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
};

async function getTokens() {
    await mongoose.connect(process.env.MONGODB_URI);

    const tokens = {};

    // 1. Admin
    const admin = await Admin.findOne({ isActive: true });
    if (admin) {
        tokens.admin = generateToken(admin._id.toString(), 'admin');
        console.log('✅ Generated Admin Token');
    }

    // 2. Restaurant
    const restaurant = await Restaurant.findOne({ isActive: true });
    if (restaurant) {
        tokens.restaurant = generateToken(restaurant._id.toString(), 'restaurant');
        console.log('✅ Generated Restaurant Token');
    }

    // 3. Delivery
    const delivery = await Delivery.findOne({ isActive: true });
    if (delivery) {
        tokens.delivery = generateToken(delivery._id.toString(), 'delivery');
        console.log('✅ Generated Delivery Token');
    }

    // 4. User (Customer)
    const user = await User.findOne({ isActive: true });
    if (user) {
        tokens.user = generateToken(user._id.toString(), 'user');
        console.log('✅ Generated User Token');
    }

    fs.writeFileSync('test_tokens.json', JSON.stringify(tokens, null, 2));
    console.log('Tokens saved to test_tokens.json');
    process.exit(0);
}

getTokens().catch(err => {
    console.error(err);
    process.exit(1);
});
