import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC8yl_OxZysE3oOaok7-hp7sP2V-vPEIfA",
  authDomain: "smart-log-bbc65.firebaseapp.com",
  projectId: "smart-log-bbc65",
  storageBucket: "smart-log-bbc65.appspot.com",
  messagingSenderId: "399257614187",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:399257614187:web:your-app-id-here"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export { auth, firestore, storage, functions };
export default app;