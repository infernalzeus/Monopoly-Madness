import { initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth, type User } from 'firebase/auth';
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

// A deployment without the VITE_FIREBASE_* variables used to crash at import time and render a blank page
// (auth/invalid-api-key). Now the app still loads and shows a clear "not configured" screen (see main.tsx).
export const firebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;

export const db = (app ? getFirestore(app) : null) as unknown as Firestore;
export const auth = (app ? getAuth(app) : null) as unknown as Auth;
export const analytics = app && typeof window !== 'undefined' ? getAnalytics(app) : null;

// Anonymous sign-in gives every browser a stable uid (persisted by Firebase) which seats are bound to,
// and lets firestore.rules require `request.auth != null`. If the Anonymous provider is not enabled in the
// Firebase console this resolves to null and the app keeps working while the rules are still open.
export const authReady: Promise<User | null> = new Promise(resolve => {
  if (!app) { resolve(null); return; }
  const unsub = onAuthStateChanged(auth, user => {
    if (user) { unsub(); resolve(user); }
  });
  signInAnonymously(auth).catch(err => {
    console.warn('[auth] anonymous sign-in failed — enable Authentication → Sign-in method → Anonymous in the Firebase console.', err?.code || err);
    resolve(null);
  });
});
export const currentUid = (): string | null => auth?.currentUser?.uid ?? null;
