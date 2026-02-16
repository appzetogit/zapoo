import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import BusinessSettings from '../modules/admin/models/BusinessSettings.js';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const updateBusinessName = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const settings = await BusinessSettings.findOne();

        if (settings) {
            console.log('Current Business Name:', settings.companyName);
            console.log('Current Email:', settings.email);

            settings.companyName = 'Zapoo';
            // Only update email if it's currently empty or the default placeholder
            if (!settings.email || settings.email === '' || settings.email.includes('appzeto')) {
                settings.email = 'info@zapoo.com';
            }

            await settings.save();
            console.log('Business Settings updated successfully!');
            console.log('New Business Name:', settings.companyName);
            console.log('New Email:', settings.email);
        } else {
            console.log('No Business Settings found. Creating new one...');
            await BusinessSettings.create({
                companyName: 'Zapoo',
                email: 'info@zapoo.com',
                region: 'India'
            });
            console.log('Created new Business Settings for Zapoo.');
        }

    } catch (error) {
        console.error('Error updating business name:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

updateBusinessName();
