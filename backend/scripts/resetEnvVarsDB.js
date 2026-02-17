
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import EnvironmentVariable from "../modules/admin/models/EnvironmentVariable.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function resetDB() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('Deleting all environment variables from DB...');
        const result = await EnvironmentVariable.deleteMany({});
        console.log(`✅ Deleted ${result.deletedCount} environment variable documents.`);

        console.log('Verifying .env variables...');
        console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || '❌ MISSING');
        console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY || '❌ MISSING');
        console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET || '❌ MISSING');

        // Force create a new empty one to verify schema defaults
        // const newEnv = await EnvironmentVariable.create({});
        // console.log('Created new empty env vars doc:', newEnv._id);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

resetDB();
