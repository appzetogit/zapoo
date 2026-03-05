import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the RTDB service account key from environment variable
let serviceAccount = null;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        // Fallback to file for local development if env not set
        const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
        if (fs.existsSync(serviceAccountPath)) {
            serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        }
    }
} catch (err) {
    console.warn('⚠️ Firebase service account could not be loaded from env or file.');
}

// Named app for RTDB — completely separate from the default Auth app (zomato-607fa)
const RTDB_APP_NAME = 'zapoo-rtdb';
let db;

export const initializeFirebaseRealtime = () => {
    if (!serviceAccount) {
        console.warn('⚠️ Firebase Realtime Database skipped: service account not available.');
        return null;
    }

    try {
        // Use a named app so it NEVER conflicts with the default Admin app used by FirebaseAuthService
        const existingApp = admin.apps.find(a => a?.name === RTDB_APP_NAME);
        const rtdbApp = existingApp || admin.initializeApp(
            {
                credential: admin.credential.cert(serviceAccount),
                // Asia-southeast1 regional URL (your project lives here)
                databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://zapoo-d23ea-default-rtdb.asia-southeast1.firebasedatabase.app'
            },
            RTDB_APP_NAME  // <-- named app, not the default app
        );

        db = rtdbApp.database();
        console.log('✅ Firebase Realtime Database Initialized Successfully');
        return db;
    } catch (err) {
        console.warn('⚠️ Firebase RTDB initialization error:', err.message);
        return null;
    }
};

export const getDb = () => {
    if (!db) {
        throw new Error('⚠️ Firebase Realtime Database not initialized. Call initializeFirebaseRealtime() first.');
    }
    return db;
};
