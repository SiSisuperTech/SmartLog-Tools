// src/components/AwsCliLogin.tsx
import React, { useState } from 'react';
import { useAwsAuth } from '../hooks/useAwsAuth';
import { Terminal, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface AwsCliLoginProps {
  onLoginSuccess?: () => void;
  className?: string;
}

const AwsCliLogin: React.FC<AwsCliLoginProps> = ({ onLoginSuccess, className = '' }) => {
  const { 
    isAuthenticated, 
    isCheckingAuth, 
    isVerifying,
    authStatus, 
    instructions,
    initiateLogin,
    verifyConnection,
    sessionId
  } = useAwsAuth();
  
  const [showInstructions, setShowInstructions] = useState(false);

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

  const handleInitiateLogin = async () => {
    const success = await initiateLogin();
    if (success) {
      setShowInstructions(true);
    }
  };

  const handleVerifyConnection = async () => {
    const success = await verifyConnection();
    if (success && onLoginSuccess) {
      onLoginSuccess();
    }
  };

  return (
    <div className={`aws-login-container ${className}`}>
      {isCheckingAuth ? (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2">Checking AWS connection...</span>
        </div>
      ) : isAuthenticated ? (
        <div className="p-4 bg-green-100 border border-green-400 rounded">
          <div className="flex items-center text-green-700">
            <CheckCircle className="w-5 h-5 mr-2" />
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
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>Not connected to AWS</span>
            </div>
            
            {!showInstructions || !sessionId ? (
              <button
                onClick={handleInitiateLogin}
                disabled={isVerifying}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 disabled:opacity-50"
              >
                {isVerifying ? (
                  <div className="flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    <span>Preparing...</span>
                  </div>
                ) : (
                  "Connect AWS SSO"
                )}
              </button>
            ) : (
              <div className="mt-2">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded mb-3">
                  <div className="font-medium text-blue-800 mb-1">AWS CLI Login Required:</div>
                  <div className="text-sm text-blue-700">
                    <ol className="list-decimal ml-5">
                      <li className="mb-1">Open your terminal</li>
                      <li className="mb-1">Run: 
                        <div className="flex items-center mt-1 p-2 bg-gray-800 text-white rounded-md font-mono text-sm">
                          <Terminal className="w-4 h-4 mr-2 text-green-400" />
                          <code>aws sso login --profile default</code>
                        </div>
                      </li>
                      <li className="mb-1">Complete the AWS SSO login in your browser</li>
                      <li>Come back here and click "Verify Connection" when done</li>
                    </ol>
                  </div>
                </div>
                
                <button
                  onClick={handleVerifyConnection}
                  disabled={isVerifying}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 w-full flex items-center justify-center"
                >
                  {isVerifying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      <span>Verify Connection</span>
                    </>
                  )}
                </button>
              </div>
            )}
            
            {error ? (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                <div className="font-medium">Error:</div>
                <div>{error}</div>
                <div className="mt-1 text-xs text-red-500">
                  Make sure you've completed the AWS SSO login in your terminal before verifying.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default AwsCliLogin;