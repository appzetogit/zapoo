import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Zone from './modules/admin/models/Zone.js';
import Tier from './modules/admin/models/Tier.js';

dotenv.config();

async function syncAllZones() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });
        console.log('Connected to DB');
        const allZones = await Zone.find({});
        console.log(`Found ${allZones.length} zones. Saving to recalculate tier assignments...`);
        let count = 0;
        for (const z of allZones) {
            await z.save();
            count++;
        }
        console.log(`Successfully synced ${count} zones.`);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

syncAllZones();
