import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const dropIndexes = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;

        // List of collections and indexes to drop based on warnings
        const collectionsToCheck = [
            { name: 'orders', index: 'userId_1' },
            { name: 'userwallets', index: 'transactions.orderId_1' },
            { name: 'deliverywallets', index: 'transactions.orderId_1' },
            { name: 'users', index: 'email_1' }, // If exists as separate index
            { name: 'users', index: 'phone_1' }, // If exists as separate index
            { name: 'restaurants', index: 'email_1' },
            { name: 'deliveries', index: 'phone_1' },
            { name: 'deliveries', index: 'deliveryId_1' }
        ];

        for (const { name, index } of collectionsToCheck) {
            try {
                const collection = db.collection(name);
                if (await collection.indexExists(index)) {
                    await collection.dropIndex(index);
                    console.log(`Dropped index ${index} from ${name}`);
                } else {
                    // Try to find index by key pattern if name doesn't match
                    const indexes = await collection.indexes();
                    // Logic to find and drop could be added here, but simple name check is safer for now
                    console.log(`Index ${index} not found in ${name} (or already dropped)`);
                }
            } catch (err) {
                console.log(`Note: Could not drop index ${index} from ${name}: ${err.message}`);
            }
        }

        // Drop the sparse indexes we removed from schema code, so Mongoose doesn't try to recreate them? 
        // Actually Mongoose syncIndexes() would handle it, checking if we can force it.
        // But dropping them manually ensures the startup warning goes away if it was about existing indexes.

        console.log('Index cleanup attempt finished.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

dropIndexes();
