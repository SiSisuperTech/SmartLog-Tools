import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import type { AwsAuthStatus } from '../types';

export const useAwsAuth = () => {
  const { currentUser } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  
  const [authStatus, setAuthStatus] = useState<AwsAuthStatus>({
    isAuthenticated: false
  });

  // Generic error handler for network and auth issues
  const handleFetchError = useCallback((error: unknown) => {
    console.error('AWS Authentication Error:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown authentication error';
    
    setAuthStatus(prevStatus => ({
      ...prevStatus,
      isAuthenticated: false,
      error: errorMessage
    }));

    setIsAuthenticated(false);
    setIsCheckingAuth(false);
  }, []);

  // Check authentication status
  const checkStatus = useCallback(async () => {
    if (!currentUser) {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
      return;
    }

    try {
      setIsCheckingAuth(true);
      
      const functions = getFunctions();
      const systemCheckAwsConnection = httpsCallable(functions, 'systemCheckAwsConnection');
      
      const result = await systemCheckAwsConnection({});
      const data = result.data as any;
      
      if (data.isAuthenticated) {
        setIsAuthenticated(true);
        setAuthStatus(prevStatus => ({
          ...prevStatus,
          isAuthenticated: true,
          identity: data.identity
        }));
      } else {
        setIsAuthenticated(false);
        setAuthStatus(prevStatus => ({
          ...prevStatus,
          isAuthenticated: false,
          error: data.error || 'Failed to authenticate with AWS'
        }));
      }
    } catch (err) {
      handleFetchError(err);
    } finally {
      setIsCheckingAuth(false);
    }
  }, [currentUser, handleFetchError]);

  // Initiate AWS CLI login process
  const initiateLogin = async () => {
    if (!currentUser) {
      console.error('Must be logged in with Firebase first');
      return false;
    }

    try {
      const functions = getFunctions();
      const initiateAwsCliLoginFunction = httpsCallable(functions, 'initiateAwsCliLogin');
      
      const result = await initiateAwsCliLoginFunction({ profile: 'default' });
      const data = result.data as any;
      
      if (data.success) {
        setSessionId(data.sessionId);
        setInstructions(data.message);
        return true;
      } else {
        throw new Error(data.error || 'Failed to initiate AWS CLI login');
      }
    } catch (error) {
      handleFetchError(error);
      return false;
    }
  };

  // Verify AWS CLI credentials
  const verifyConnection = async () => {
    if (!sessionId) {
      console.error('No active session. Please initiate login first.');
      return false;
    }

    try {
      setIsVerifying(true);
      
      const functions = getFunctions();
      const verifyAwsCliCredentialsFunction = httpsCallable(functions, 'verifyAwsCliCredentials');
      
      const result = await verifyAwsCliCredentialsFunction({ sessionId });
      const data = result.data as any;
      
      if (data.success && data.isAuthenticated) {
        setIsAuthenticated(true);
        setAuthStatus(prevStatus => ({
          ...prevStatus,
          isAuthenticated: true,
          identity: data.identity
        }));
        return true;
      } else {
        setIsAuthenticated(false);
        setAuthStatus(prevStatus => ({
          ...prevStatus,
          isAuthenticated: false,
          error: data.error || 'Failed to verify AWS credentials'
        }));
        return false;
      }
    } catch (error) {
      handleFetchError(error);
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  // Check status on component mount and periodically
  useEffect(() => {
    if (currentUser) {
      checkStatus();
      const interval = setInterval(checkStatus, 300000); // Check every 5 minutes
      return () => clearInterval(interval);
    } else {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
    }
  }, [currentUser, checkStatus]);

  return {
    isAuthenticated,
    isCheckingAuth,
    isVerifying,
    authStatus,
    instructions,
    initiateLogin,
    verifyConnection,
    sessionId
  };
};