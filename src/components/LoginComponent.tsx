// src/components/LoginComponent.tsx
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, LogOut, User, AlertTriangle } from 'lucide-react';

const LoginComponent: React.FC = () => {
  const { currentUser, loading, error, signIn, signOut, isAuthorized } = useAuth();

  const handleSignIn = async () => {
    await signIn();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-white/5 rounded-lg">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
        <span className="text-gray-200">Authenticating...</span>
      </div>
    );
  }

  if (currentUser && isAuthorized) {
    return (
      <div className="bg-white/10 rounded-lg p-4 shadow-lg">
        <div className="flex items-center space-x-3 mb-3">
          {currentUser.photoURL ? (
            <img 
              src={currentUser.photoURL} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-blue-400"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <div className="font-medium text-white">{currentUser.displayName || 'User'}</div>
            <div className="text-sm text-gray-300">{currentUser.email}</div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center bg-red-600/80 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white/10 rounded-lg p-4 shadow-lg">
      <h2 className="text-xl font-semibold text-white mb-2">Authentication Required</h2>
      <p className="text-gray-300 text-sm mb-4">
        Please sign in with your Google account to access the application.
      </p>
      
      {error && (
        <div className="bg-red-500/30 border border-red-600 text-white px-3 py-2 rounded-md mb-4 flex items-start">
          <AlertTriangle className="w-5 h-5 text-red-300 mr-2 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      <button
        onClick={handleSignIn}
        className="w-full flex items-center justify-center bg-blue-600/80 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
      >
        <LogIn className="w-5 h-5 mr-2" />
        Sign in with Google
      </button>
      <p className="text-xs text-gray-400 text-center mt-3">
        Only authorized email domains can access this application.
      </p>
    </div>
  );
};

export default LoginComponent;