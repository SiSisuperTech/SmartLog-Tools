// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '../firebase';
import { doc, getFirestore, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

// Auth context types
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<User | null>;
  signOut: () => Promise<void>;
  isAuthorized: boolean;
}

// Create context
const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  error: null,
  signIn: async () => null,
  signOut: async () => {},
  isAuthorized: false
});

// Hook to use auth context
export const useAuth = () => useContext(AuthContext);

// Allowed domain for email
const ALLOWED_DOMAIN = '@allisone.ai';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // Firestore instance
  const firestore = getFirestore();

  // Function to check if a user is authorized
  const checkIsAuthorized = async (user: User | null) => {
    if (!user || !user.email) {
      setIsAuthorized(false);
      return false;
    }
    
    // Check domain
    const hasDomain = user.email.endsWith(ALLOWED_DOMAIN);
    
    if (!hasDomain) {
      console.log("User with unauthorized domain, automatic sign-out");
      setError("Only @allisone.ai emails are authorized");
      await signOut(auth);
      setIsAuthorized(false);
      return false;
    }
    
    // Optional: Check against whitelist in Firestore
    try {
      // Check if user exists in whitelist
      const userDoc = await getDoc(doc(firestore, 'authorizedUsers', user.email));
      
      if (!userDoc.exists()) {
        // Add the user to the authorized users collection (first time login)
        await setDoc(doc(firestore, 'authorizedUsers', user.email), {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
      } else {
        // Update last login time
        await setDoc(doc(firestore, 'authorizedUsers', user.email), {
          lastLogin: serverTimestamp()
        }, { merge: true });
      }
      
      // Log the login for audit purposes
      await setDoc(doc(firestore, 'loginLogs', `${user.uid}_${Date.now()}`), {
        email: user.email,
        displayName: user.displayName,
        uid: user.uid,
        timestamp: serverTimestamp(),
        device: navigator.userAgent
      });
      
      setIsAuthorized(true);
      return true;
    } catch (err) {
      console.error("Error checking authorization:", err);
      // If there's an error checking authorization, default to domain check only
      setIsAuthorized(hasDomain);
      return hasDomain;
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if user is authorized
        const authorized = await checkIsAuthorized(user);
        
        if (authorized) {
          setCurrentUser(user);
          setError(null);
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
        setIsAuthorized(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign in function
  const handleSignIn = async (): Promise<User | null> => {
    try {
      setLoading(true);
      setError(null);
      
      // Configure Google provider
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account',
        hd: ALLOWED_DOMAIN.substring(1) // Removes the @ and sets the hosted domain
      });

      // Sign in with popup
      const result = await signInWithPopup(auth, provider);
      
      // Additional verification after sign-in
      if (result.user.email && !result.user.email.endsWith(ALLOWED_DOMAIN)) {
        console.error("Domain verification failed");
        await signOut(auth);
        setError("Only @allisone.ai emails are authorized");
        setLoading(false);
        return null;
      }
      
      return result.user;
    } catch (err: any) {
      console.error("Sign in error:", err);
      
      // Handle different error scenarios
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Sign-in cancelled");
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("Unauthorized domain. Contact administrator");
      } else {
        setError(err.message || "Failed to sign in");
      }
      
      setLoading(false);
      return null;
    }
  };

  // Sign out function
  const handleSignOut = async (): Promise<void> => {
    try {
      setLoading(true);
      await signOut(auth);
      setError(null);
    } catch (err: any) {
      console.error("Sign out error:", err);
      setError(err.message || "Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  // Context value
  const value = {
    currentUser,
    loading,
    error,
    signIn: handleSignIn,
    signOut: handleSignOut,
    isAuthorized
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : (
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
            <p className="mt-4 text-gray-700">Loading...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};