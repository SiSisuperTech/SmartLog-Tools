// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, logOut, checkUserAuthorization } from '../firebase';

interface AuthState {
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  isAuthorized: boolean;
}

interface AuthContextType extends AuthState {
  signIn: () => Promise<User | void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const initialState: AuthState = {
  currentUser: null,
  loading: true,
  error: null,
  isAuthorized: false
};

const AuthContext = createContext<AuthContextType>({
  ...initialState,
  signIn: async () => {},
  signOut: async () => {},
  checkAuth: async () => false
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

  // Unified state update function
  const updateState = (newState: Partial<AuthState>) => {
    setState(prevState => ({ ...prevState, ...newState }));
  };

  useEffect(() => {
    // Set up auth listener
    const unsubscribe = onAuthChange(async (user) => {
      if (user) {
        try {
          const isAuthorized = await checkUserAuthorization(user);
          updateState({ 
            currentUser: user, 
            loading: false, 
            isAuthorized 
          });
          
          if (!isAuthorized) {
            console.log("User not authorized in context, logging out");
            await logOut();
            updateState({ 
              currentUser: null, 
              isAuthorized: false,
              loading: false 
            });
          }
        } catch (error) {
          console.error("Error in auth state change:", error);
          updateState({ 
            loading: false, 
            error: error instanceof Error ? error.message : 'Unknown error',
            isAuthorized: false
          });
        }
      } else {
        // User is signed out
        updateState({ 
          currentUser: null, 
          loading: false, 
          isAuthorized: false 
        });
      }
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  // Sign in function
  const signIn = async () => {
    try {
      updateState({ loading: true, error: null });
      const user = await signInWithGoogle();
      return user;
    } catch (error) {
      updateState({ 
        error: error instanceof Error ? error.message : 'Sign in failed', 
        loading: false 
      });
    } finally {
      updateState({ loading: false });
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      updateState({ loading: true, error: null });
      await logOut();
      updateState({ 
        currentUser: null, 
        isAuthorized: false,
        loading: false 
      });
    } catch (error) {
      updateState({ 
        error: error instanceof Error ? error.message : 'Sign out failed',
        loading: false 
      });
    }
  };

  // Manual check for authorization
  const checkAuth = async (): Promise<boolean> => {
    if (!state.currentUser) return false;
    
    try {
      const isAuthorized = await checkUserAuthorization(state.currentUser);
      updateState({ isAuthorized });
      return isAuthorized;
    } catch (error) {
      console.error("Error checking authorization:", error);
      return false;
    }
  };

  // Context value
  const value = {
    ...state,
    signIn,
    signOut,
    checkAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {!state.loading && children}
    </AuthContext.Provider>
  );
};