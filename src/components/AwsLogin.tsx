import React, { useState } from 'react';
import { useAwsAuth } from '../hooks/useAwsAuth';
import AwsSsoConfigComponent from './AwsSsoConfigComponent';

interface AwsLoginProps {
  onLoginSuccess?: () => void;
  className?: string;
}

const AwsLogin: React.FC<AwsLoginProps> = ({ onLoginSuccess, className = '' }) => {
  const { 
    login, 
    setupAwsSso,
    isAuthenticated, 
    isCheckingAuth, 
    isSsoLoading, 
    authStatus,
    awsSsoConfig
  } = useAwsAuth();

  const [isConfiguring, setIsConfiguring] = useState(false);

  const handleLogin = async () => {
    try {
      await login();
      if (isAuthenticated && onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      // If setup is required, switch to configuration mode
      if (authStatus?.requiresSetup) {
        setIsConfiguring(true);
      }
    }
  };

  const handleAwsSsoSetup = async (config: {
    startUrl: string;
    clientId: string;
    region?: string;
    accountId?: string;
    roleName?: string;
  }) => {
    try {
      await setupAwsSso(config);
      setIsConfiguring(false);
      // Automatically attempt login after setup
      await login();
      if (isAuthenticated && onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      console.error('AWS SSO Setup Error:', error);
    }
  };

  // Render configuration component if needed
  if (isConfiguring || (authStatus?.requiresSetup && !awsSsoConfig?.configured)) {
    return (
      <AwsSsoConfigComponent 
        onConfigComplete={handleAwsSsoSetup}
        error={authStatus?.error}
      />
    );
  }

  // Safe identity accessor
  const getIdentity = (): string | null => {
    if (authStatus && 
        typeof authStatus === 'object' && 
        'identity' in authStatus && 
        typeof authStatus.identity === 'string') {
      return authStatus.identity;
    }
    return null;
  };

  // Safe error accessor
  const getError = (): string | null => {
    if (authStatus && 
        typeof authStatus === 'object' && 
        'error' in authStatus && 
        typeof authStatus.error === 'string') {
      return authStatus.error;
    }
    return null;
  };

  const identity = getIdentity();
  const error = getError();

  return (
    <div className={`aws-login-container ${className}`}>
      {isCheckingAuth ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2">Checking AWS credentials...</span>
        </div>
      ) : isAuthenticated ? (
        <div className="p-4 bg-green-100 border border-green-400 rounded">
          <div className="flex items-center text-green-700">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold">AWS SSO Connected</span>
          </div>
          {identity ? (
            <div className="mt-1 text-sm text-gray-600 truncate">
              Identity: {identity}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded">
          <div className="flex flex-col">
            <div className="flex items-center text-gray-700 mb-2">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Not connected to AWS</span>
            </div>
            <button
              onClick={handleLogin}
              disabled={isSsoLoading}
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 disabled:opacity-50"
            >
              {isSsoLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="ml-2">Connecting...</span>
                </div>
              ) : (
                "Connect AWS SSO"
              )}
            </button>
            {error ? (
              <div className="mt-2 text-sm text-red-600">
                Error: {error}
              </div>
            ) : null}
            {isSsoLoading && (
              <div className="mt-2 text-sm text-gray-600">
                <p>A browser window should open for AWS SSO login.</p>
                <p>Please complete the login process in the new window.</p>
              </div>
            )}
            {awsSsoConfig && !awsSsoConfig.configured && (
              <div className="mt-4">
                <button
                  onClick={() => setIsConfiguring(true)}
                  className="text-blue-500 hover:underline"
                >
                  Configure AWS SSO
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AwsLogin;