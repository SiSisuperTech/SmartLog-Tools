// src/firebase.ts
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  onAuthStateChanged,
  User,
  getIdTokenResult
} from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Firebase configuration should use environment variables in production
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC8yl_OxZysE3oOaok7-hp7sP2V-vPEIfA",
  authDomain: "smart-log-bbc65.firebaseapp.com", // Fixed authDomain format
  projectId: "smart-log-bbc65",
  storageBucket: "smart-log-bbc65.appspot.com",
  messagingSenderId: "399257614187",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "VOTRE_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Google Authentication with improved error handling
export const signInWithGoogle = async () => {
  try {
    // Force account selection for better user experience
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Google authentication error:", error);
    
    // Provide more detailed error information
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error("Authentication cancelled by user");
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error("Authentication popup was blocked. Please allow popups for this site.");
    } else {
      throw error;
    }
  }
};

// Check if a user is authorized to access the app
export const checkUserAuthorization = async (user: User): Promise<boolean> => {
  if (!user || !user.email) return false;
  
  try {
    // Method 1: Check custom claims (requires backend setup)
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult.claims.authorized === true) {
      return true;
    }
    
    // Method 2: Check Firestore authorized users collection
    const userDoc = await getDoc(doc(firestore, 'authorizedUsers', user.email));
    if (userDoc.exists()) {
      return true;
    }
    
    // Method 3: Check domain (fallback)
    if (user.email.endsWith('@allisone.ai')) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking user authorization:", error);
    return false;
  }
};

// Enhanced logout with cleanup
export const logOut = async () => {
  try {
    // Perform any cleanup before logout if needed
    // e.g., clear local storage, reset app state, etc.
    
    await signOut(auth);
    console.log("Successfully logged out");
  } catch (error) {
    console.error("Logout error:", error);
    throw error;
  }
};

// Observer for authentication state changes with authorization check
export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const isAuthorized = await checkUserAuthorization(user);
      if (!isAuthorized) {
        console.log("User not authorized, logging out:", user.email);
        await logOut();
        callback(null);
        return;
      }
    }
    callback(user);
  });
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export { auth, firestore };