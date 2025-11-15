import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';

// Firebase configuration from environment variables
// Vite uses import.meta.env for environment variables
// Variables must be prefixed with VITE_ to be exposed to the client

// Fallback values (Firebase API keys are safe to expose - they're public by design)
const FIREBASE_CONFIG_FALLBACK = {
  apiKey: "AIzaSyDamWmgBYUfXggdYAhIZskh8FylXftbstc",
  authDomain: "muscule-up.firebaseapp.com",
  projectId: "muscule-up",
  storageBucket: "muscule-up.firebasestorage.app",
  messagingSenderId: "320921048765",
  appId: "1:320921048765:web:b27768ea33413c1f4a89d4",
  measurementId: "G-MMTNLMECP0"
};

// Use environment variables if available, otherwise use fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FIREBASE_CONFIG_FALLBACK.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FIREBASE_CONFIG_FALLBACK.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || FIREBASE_CONFIG_FALLBACK.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || FIREBASE_CONFIG_FALLBACK.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || FIREBASE_CONFIG_FALLBACK.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FIREBASE_CONFIG_FALLBACK.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || FIREBASE_CONFIG_FALLBACK.measurementId
};

// Log if using fallback (for debugging)
if (!import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn('⚠️ Using hardcoded Firebase config. Set VITE_FIREBASE_* environment variables for production.');
}

// Validate that we have a valid config (either from env vars or fallback)
// Since we have fallback values, we don't need to throw an error
// But we'll log a warning if using fallback in production
if (import.meta.env.PROD && !import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn(
    '⚠️ Firebase config: Using hardcoded values in production. ' +
    'Consider setting VITE_FIREBASE_* environment variables in Vercel Dashboard for better security.'
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Initialize Remote Config
export const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour
remoteConfig.defaultConfig = {
  openrouter_api_key: ''
};

// Configure Google Auth Provider
export const googleProvider = new GoogleAuthProvider();

export default app;

