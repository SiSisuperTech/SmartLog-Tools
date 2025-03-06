// src/components/LoginComponent.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LoginComponent: React.FC = () => {
  const { currentUser, loading, error, signIn, signOut } = useAuth();
  const [authInProgress, setAuthInProgress] = useState(false);

  const handleSignIn = async () => {
    try {
      setAuthInProgress(true);
      await signIn();
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setAuthInProgress(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setAuthInProgress(true);
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setAuthInProgress(false);
    }
  };

  if (loading || authInProgress) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-blue-500">Authenticating...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  if (currentUser) {
    return (
      <div className="bg-white shadow rounded-lg p-6 max-w-md mx-auto">
        <div className="flex items-center space-x-4 mb-4">
          {currentUser.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt="Profile"
              className="h-12 w-12 rounded-full"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl">
              {currentUser.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <div className="font-medium text-gray-900">{currentUser.displayName || 'User'}</div>
            <div className="text-gray-500 text-sm">{currentUser.email}</div>
          </div>
        </div>
        
        <button
          onClick={handleSignOut}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition duration-200"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Log Analysis Hub</h2>
      <p className="mb-6 text-gray-600 text-center">Sign in to access your log analytics dashboard</p>
      
      <button
        onClick={handleSignIn}
        className="flex items-center justify-center w-full bg-white border border-gray-300 rounded-lg shadow-sm px-4 py-2 mb-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" width="24" height="24">
          <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z" />
            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z" />
            <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z" />
            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z" />
          </g>
        </svg>
        Sign in with Google
      </button>
      
      <p className="text-xs text-center text-gray-500 mt-4">
        Only authorized email domains can access this application.
      </p>
    </div>
  );
};

export default LoginComponent;