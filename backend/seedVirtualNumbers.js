import 'dotenv/config';
import mongoose from 'mongoose';
import VirtualNumber from './modules/telephony/models/VirtualNumber.js';

const seedVirtualNumbers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4 });
    console.log('Connected to MongoDB');

    // Seed virtual numbers for Indore
    const virtualNumbers = [
      { number: '+919876543210', city: 'indore' },
      { number: '+919876543211', city: 'indore' },
      { number: '+919876543212', city: 'indore' },
    ];

    for (const vn of virtualNumbers) {
      const existing = await VirtualNumber.findOne({ number: vn.number });
      if (!existing) {
        await VirtualNumber.create(vn);
        console.log(`Seeded virtual number: ${vn.number} for ${vn.city}`);
      } else {
        console.log(`Virtual number ${vn.number} already exists`);
      }
    }

    console.log('Virtual number seeding completed');
  } catch (error) {
    console.error('Error seeding virtual numbers:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

seedVirtualNumbers();