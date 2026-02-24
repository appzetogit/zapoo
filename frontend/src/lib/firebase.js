import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase configuration - strictly use environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Validate Firebase configuration
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'appId', 'messagingSenderId'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field] || firebaseConfig[field] === 'undefined');

if (missingFields.length > 0) {
  console.error('Firebase configuration is missing required fields:', missingFields);
  console.error('Current config:', firebaseConfig);
  console.error('Environment variables:', {
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  });
  throw new Error(`Firebase configuration error: Missing fields: ${missingFields.join(', ')}. Please check your .env file and restart the dev server.`);
}

// Initialize Firebase app only once
let app;
let firebaseAuth;
let googleProvider;

// Function to ensure Firebase is initialized
function ensureFirebaseInitialized() {
  try {
    const existingApps = getApps();
    if (existingApps.length === 0) {
      app = initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully with config:', {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        apiKey: firebaseConfig.apiKey ? firebaseConfig.apiKey.substring(0, 20) + '...' : 'missing'
      });
    } else {
      app = existingApps[0];
      console.log('Firebase app already initialized, reusing existing instance');
    }

    // Initialize Auth - ensure it's connected to the app
    if (!firebaseAuth) {
      firebaseAuth = getAuth(app);
      if (!firebaseAuth) {
        throw new Error('Failed to get Firebase Auth instance');
      }
      console.log('Firebase Auth initialized successfully', {
        app: app.name,
        authApp: firebaseAuth.app.name
      });
    }

    // Initialize Google Provider
    if (!googleProvider) {
      googleProvider = new GoogleAuthProvider();
      // Add scopes if needed
      googleProvider.addScope('email');
      googleProvider.addScope('profile');
      // Note: Don't set custom client_id - Firebase uses its own OAuth client
      console.log('Google Auth Provider initialized');
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    console.error('Firebase config used:', firebaseConfig);
    throw error;
  }
}

// Initialize immediately
ensureFirebaseInitialized();

export const firebaseApp = app;
export { firebaseAuth, googleProvider, ensureFirebaseInitialized };


