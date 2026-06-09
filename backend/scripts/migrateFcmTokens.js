import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../modules/auth/models/User.js';
import Restaurant from '../modules/restaurant/models/Restaurant.js';
import Delivery from '../modules/delivery/models/Delivery.js';
import Admin from '../modules/admin/models/Admin.js';
import DeviceToken from '../modules/notification/models/DeviceToken.js';

async function runMigration() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const models = {
            user: User,
            restaurant: Restaurant,
            delivery: Delivery,
            admin: Admin
        };

        // 1. Migrate legacy fields directly on collections FIRST so strings become arrays
        for (const [role, Model] of Object.entries(models)) {
            const docs = await Model.find({
                $or: [
                    { fcmTokenApp: { $exists: true, $ne: null } },
                    { fcmTokens: { $exists: true, $not: { $size: 0 } } },
                    { fcmTokenWeb: { $type: "string" } },
                    { fcmTokenMobile: { $type: "string" } }
                ]
            });

            console.log(`Found ${docs.length} ${role} records with legacy or string token fields.`);
            for (const doc of docs) {
                // Initialize arrays from existing data if they were strings
                let webTokens = [];
                let mobileTokens = [];

                if (doc.fcmTokenWeb) {
                    if (Array.isArray(doc.fcmTokenWeb)) webTokens = [...doc.fcmTokenWeb];
                    else if (typeof doc.fcmTokenWeb === 'string') webTokens = [doc.fcmTokenWeb];
                }

                if (doc.fcmTokenMobile) {
                    if (Array.isArray(doc.fcmTokenMobile)) mobileTokens = [...doc.fcmTokenMobile];
                    else if (typeof doc.fcmTokenMobile === 'string') mobileTokens = [doc.fcmTokenMobile];
                }

                // Move fcmTokenApp to fcmTokenMobile
                if (doc.fcmTokenApp && typeof doc.fcmTokenApp === 'string') {
                    if (!mobileTokens.includes(doc.fcmTokenApp)) {
                        mobileTokens.push(doc.fcmTokenApp);
                    }
                }

                // If fcmTokens exists and contains items, push them somewhere
                if (doc.fcmTokens && Array.isArray(doc.fcmTokens)) {
                    for (const t of doc.fcmTokens) {
                        if (t && typeof t === 'string' && t.trim()) {
                            if (!mobileTokens.includes(t)) {
                                mobileTokens.push(t);
                            }
                        }
                    }
                }

                // Ensure arrays have at most 10 items
                if (webTokens.length > 10) webTokens = webTokens.slice(-10);
                if (mobileTokens.length > 10) mobileTokens = mobileTokens.slice(-10);

                // Update using $set for new arrays and $unset for old strings/legacy fields
                await Model.updateOne(
                    { _id: doc._id },
                    {
                        $set: {
                            fcmTokenWeb: webTokens,
                            fcmTokenMobile: mobileTokens
                        },
                        $unset: {
                            fcmTokens: "",
                            fcmTokenApp: ""
                        }
                    },
                    { strict: false }
                );
            }
        }

        // 2. Migrate tokens from DeviceToken collection
        const deviceTokens = await DeviceToken.find({});
        console.log(`Found ${deviceTokens.length} device tokens to migrate.`);
        for (const dt of deviceTokens) {
            const Model = models[dt.role];
            if (!Model) continue;

            const updateField = dt.platform === 'web' ? 'fcmTokenWeb' : 'fcmTokenMobile';
            
            // We can safely use $addToSet now because step 1 converted all existing fields to arrays
            await Model.updateOne(
                { _id: dt.userId },
                { $addToSet: { [updateField]: dt.deviceToken } }
            );
        }

        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
