import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const deviceTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    role: { type: String, required: true },
    deviceToken: { type: String, required: true },
    platform: { type: String, default: 'web' },
    isActive: { type: Boolean, default: true }
});

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);

async function checkTokens() {
    try {
        console.log('Connecting to:', process.env.MONGODB_URI?.substring(0, 20) + '...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const tokens = await DeviceToken.find({});
        console.log('Total tokens:', tokens.length);

        const roles = {};
        tokens.forEach(t => {
            roles[t.role] = (roles[t.role] || 0) + 1;
        });
        console.log('Tokens by role:', roles);

        const restaurantTokens = tokens.filter(t => t.role === 'restaurant');
        if (restaurantTokens.length > 0) {
            console.log('Restaurant Tokens Found:', restaurantTokens.length);
            restaurantTokens.forEach((t, i) => {
                console.log(`[${i}] ID: ${t.userId}, Token: ${t.deviceToken.substring(0, 10)}...`);
            });
        } else {
            console.log('NO RESTAURANT TOKENS FOUND');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkTokens();
