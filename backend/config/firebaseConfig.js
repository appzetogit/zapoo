import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the service account key using fs
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

let db;

export const initializeFirebaseRealtime = () => {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://zapoo-d23ea.firebaseio.com" // Extracted from project_id
        });
    }
    db = admin.database();
    console.log("✅ Firebase Realtime Database Initialized Successfully");
    return db;
};

export const getDb = () => {
    if (!db) {
        throw new Error("⚠️ Firebase Realtime Database not initialized. Call initializeFirebaseRealtime() first.");
    }
    return db;
};
