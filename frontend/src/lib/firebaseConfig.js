import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getMessaging, isSupported } from 'firebase/messaging';

/**
 * Firebase Config — Two separate Firebase apps:
 *
 * 1. 'zapoo-rtdb'  (zapoo-d23ea project)
 *    — Realtime Database (RTDB) for live promo notifications
 *    — FCM Messaging (same project) for web push
 *
 * 2. Default / Auth app stays as-is (zomato-607fa) if used elsewhere
 */

const FCM_APP_NAME = 'zapoo-rtdb';

const zapooConfig = {
    apiKey: import.meta.env.VITE_FCM_API_KEY || 'AIzaSyAO32xTBf-xq4cjzRfbtzyCUny8zY_j3WM',
    authDomain: 'zapoo-d23ea.firebaseapp.com',
    projectId: 'zapoo-d23ea',
    storageBucket: 'zapoo-d23ea.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FCM_MESSAGING_SENDER_ID || '152641542029',
    appId: import.meta.env.VITE_FCM_APP_ID || '1:152641542029:web:6f0fec400684654c95cfc4',
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ||
        'https://zapoo-d23ea-default-rtdb.asia-southeast1.firebasedatabase.app',
};

// Re-use the named app if already initialized (HMR / strict-mode safety)
const existingApp = getApps().find(a => a.name === FCM_APP_NAME);
const zapooApp = existingApp || initializeApp(zapooConfig, FCM_APP_NAME);

// Realtime Database — used by UserLayout for in-app popup listener
export const realtimeDb = getDatabase(zapooApp);

// FCM Messaging — used by useFCMNotification hook
// getMessaging() throws in service-worker context; guard with isSupported()
let _messaging = null;
export const getFirebaseMessaging = async () => {
    if (_messaging) return _messaging;
    const supported = await isSupported();
    if (!supported) return null;
    _messaging = getMessaging(zapooApp);
    return _messaging;
};

export { zapooApp };
