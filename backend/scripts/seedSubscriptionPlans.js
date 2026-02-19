import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import SubscriptionPlan from '../modules/admin/models/SubscriptionPlan.js';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const plans = [
    {
        name: 'Starter',
        pricing: {
            tier1: 499,
            tier2: 599,
            tier3: 699,
            tier4: 799
        },
        durationInDays: 30,
        features: ['Basic Listing', 'Standard Delivery', 'Email Support'],
        isActive: true
    },
    {
        name: 'Growth',
        pricing: {
            tier1: 1499,
            tier2: 1699,
            tier3: 1899,
            tier4: 2099
        },
        durationInDays: 30,
        features: ['Featured Listing', 'Priority Delivery', 'Marketing Tools', '24/7 Support'],
        isActive: true
    },
    {
        name: 'Enterprise',
        pricing: {
            tier1: 2999,
            tier2: 3499,
            tier3: 3999,
            tier4: 4499
        },
        durationInDays: 30,
        features: ['Top Placement', 'Zero Commission', 'Dedicated Manager', 'Advanced Analytics'],
        isActive: true
    }
];

const seedPlans = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing plans to ensure only fixed plans exist
        await SubscriptionPlan.deleteMany({});
        console.log('Cleared existing subscription plans.');

        await SubscriptionPlan.insertMany(plans);
        console.log('Subscription plans (Starter, Growth, Enterprise) seeded successfully');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding plans:', error);
        process.exit(1);
    }
};

seedPlans();
