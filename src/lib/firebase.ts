import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
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

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Anonymous sign-in gives every browser a stable uid (persisted by Firebase) which seats are bound to,
// and lets firestore.rules require `request.auth != null`. If the Anonymous provider is not enabled in the
// Firebase console this resolves to null and the app keeps working while the rules are still open.
export const authReady: Promise<User | null> = new Promise(resolve => {
  const unsub = onAuthStateChanged(auth, user => {
    if (user) { unsub(); resolve(user); }
  });
  signInAnonymously(auth).catch(err => {
    console.warn('[auth] anonymous sign-in failed — enable Authentication → Sign-in method → Anonymous in the Firebase console.', err?.code || err);
    resolve(null);
  });
});
export const currentUid = (): string | null => auth.currentUser?.uid ?? null;
