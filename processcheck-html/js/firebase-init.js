// ═══════════════════════════════════════════════════════════════════════════════
// Firebase Init — CDN ES module version
// ═══════════════════════════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase config — these values are safe to expose in client code
// Replace with your own Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCmQ4-zOqeZKIxBIdYP71uhIdZ0eQu2rn0",
  authDomain: "processsss-appp.firebaseapp.com",
  projectId: "processsss-appp",
  storageBucket: "processsss-appp.firebasestorage.app",
  messagingSenderId: "1041230235574",
  appId: "1:1041230235574:web:de73f68d8c567ee5d96317",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
