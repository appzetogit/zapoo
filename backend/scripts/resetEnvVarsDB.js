import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import EnvironmentVariable from "../modules/admin/models/EnvironmentVariable.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({
  path: path.join(__dirname, '../.env')
});
async function resetDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const result = await EnvironmentVariable.deleteMany({});
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