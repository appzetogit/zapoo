import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SubscriptionPlan from '../modules/admin/models/SubscriptionPlan.js';

dotenv.config();

const plans = [
  {
    name: 'BASIC',
    pricing: {
      tier1: 999,
      tier2: 1499,
      tier3: 1999,
      tier4: 2499
    },
    durationInDays: 30,
    features: [
      'order_management',
      'menu_control',
      'basic_reports',
      'marketing_tools'
    ],
    isActive: true
  },
  {
    name: 'GROWTH',
    pricing: {
      tier1: 1999,
      tier2: 2999,
      tier3: 3999,
      tier4: 4999
    },
    durationInDays: 30,
    features: [
      'order_management',
      'menu_control',
      'basic_reports',
      'marketing_tools',
      'advanced_analytics',
      'advanced_marketing_tools',
      'relationship_manager'
    ],
    isActive: true
  },
  {
    name: 'EXECUTIVE',
    pricing: {
      tier1: 1499,
      tier2: 2499,
      tier3: 3499,
      tier4: 4499
    },
    durationInDays: 30,
    features: [
      'order_management',
      'menu_control',
      'basic_reports',
      'relationship_manager'
    ],
    isActive: true
  }
];

const seedPlans = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    for (const plan of plans) {
      await SubscriptionPlan.findOneAndUpdate(
        { name: plan.name },
        plan,
        { upsert: true, new: true }
      );
    }

    console.log('Subscription plans seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding plans:', error);
    process.exit(1);
  }
};

seedPlans();
