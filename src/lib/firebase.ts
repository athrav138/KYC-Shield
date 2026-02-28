import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase only if API key is present and looks valid (not empty and not a placeholder)
const isConfigValid = !!firebaseConfig.apiKey && 
                     firebaseConfig.apiKey !== "" && 
                     !firebaseConfig.apiKey.includes("YOUR_");

const app = isConfigValid ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app) : null as any;
export const analytics = (app && typeof window !== 'undefined' && firebaseConfig.measurementId) ? getAnalytics(app) : null;

if (!isConfigValid) {
  console.warn("Firebase is not initialized: VITE_FIREBASE_API_KEY is missing or invalid.");
}

export default app;
