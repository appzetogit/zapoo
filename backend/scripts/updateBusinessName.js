import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import BusinessSettings from '../modules/admin/models/BusinessSettings.js';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({
  path: path.join(__dirname, '../.env')
});
const updateBusinessName = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const settings = await BusinessSettings.findOne();
    if (settings) {
      settings.companyName = 'Zapoo';
      // Only update email if it's currently empty or the default placeholder
      if (!settings.email || settings.email === '' || settings.email.includes('appzeto')) {
        settings.email = 'info@zapoo.com';
      }
      await settings.save();
    } else {
      await BusinessSettings.create({
        companyName: 'Zapoo',
        email: 'info@zapoo.com',
        region: 'India'
      });
    }
  } catch (error) {
    console.error('Error updating business name:', error);
  } finally {
    await mongoose.disconnect();
  }
};
updateBusinessName();