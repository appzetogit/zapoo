import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSy_REPLACEME_IF_AVAILABLE", // Realtime DB usually doesn't strictly need a browser API key if rules allow it, but we'll put a placeholder
    authDomain: "zapoo-d23ea.firebaseapp.com", // from project_id
    databaseURL: "https://zapoo-d23ea-default-rtdb.firebaseio.com", // typical default URL format for realtime db
    projectId: "zapoo-d23ea", // from project_id
    storageBucket: "zapoo-d23ea.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef123456"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and get a reference to the service
export const realtimeDb = getDatabase(app);
