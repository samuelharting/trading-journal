import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDOjotfwLgzH0io2GZqqZC88nHMmxB1ERM",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "trading-journal-app-d492e.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "trading-journal-app-d492e",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "trading-journal-app-d492e.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "138750603677",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:138750603677:web:4d3e4ab3912c349e4bff74",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-M1GEFJYEGS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage }; 