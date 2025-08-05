import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDOjotfwLgzH0io2GZqqZC88nHMmxB1ERM",
  authDomain: "trading-journal-app-d492e.firebaseapp.com",
  projectId: "trading-journal-app-d492e",
  storageBucket: "trading-journal-app-d492e.firebasestorage.app",
  messagingSenderId: "138750603677",
  appId: "1:138750603677:web:4d3e4ab3912c349e4bff74",
  measurementId: "G-M1GEFJYEGS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage }; 