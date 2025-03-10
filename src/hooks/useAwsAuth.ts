import { useState, useCallback, useEffect } from 'react';
import { functions } from '../firebase'; // Your Firebase config
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext'; // Assuming you have an auth context

// Types for SSO login states and responses
interface SsoSessionInfo {
  sessionId: string;
  userCode: string;
  verificationUri: string;
}

interface SsoStatusResponse {
  status: 'pending' | 'authorized' | 'failed';
  identity?: string | null;
}

interface AwsSsoConfig {
  configured: boolean;
  startUrl?: string;
  region?: string;
}

export function useAwsAuth() {
  const { currentUser } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSsoLoading, setIsSsoLoading] = useState(false);
  const [awsSsoConfig, setAwsSsoConfig] = useState<AwsSsoConfig | null>(null);
  const [authStatus, setAuthStatus] = useState<{
    status?: string;
    identity?: string | null;
    error?: string;
    requiresSetup?: boolean;
  } | null>(null);

  // Check AWS authentication status and configuration on component mount
  useEffect(() => {
    const checkAwsAuthStatus = async () => {
      if (!currentUser) {
        setIsAuthenticated(null);
        setIsCheckingAuth(false);
        return;
      }

      try {
        setIsCheckingAuth(true);
        
        // Get user's AWS SSO configuration
        const getUserAwsSsoConfig = httpsCallable<void, AwsSsoConfig>(
          functions, 
          'getUserAwsSsoConfig'
        );
        const configResult = await getUserAwsSsoConfig();
        setAwsSsoConfig(configResult.data);

        // Check authentication status
        const checkAuthCallable = httpsCallable<void, {
          isAuthenticated: boolean;
          identity?: string;
        }>(functions, 'checkUserAwsAuthStatus');
        
        const result = await checkAuthCallable();
        
        setIsAuthenticated(result.data.isAuthenticated);
        setAuthStatus({
          status: result.data.isAuthenticated ? 'authorized' : 'failed',
          identity: result.data.identity
        });
      } catch (error) {
        console.error('AWS Auth Check Error:', error);
        setIsAuthenticated(false);
        setAuthStatus({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Authentication check failed'
        });
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAwsAuthStatus();
  }, [currentUser]);

  // Setup AWS SSO Configuration
  const setupAwsSso = useCallback(async (config: {
    startUrl: string;
    clientId: string;
    region?: string;
    accountId?: string;
    roleName?: string;
  }) => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      const setupUserAwsSsoConfig = httpsCallable<
        typeof config, 
        { success: boolean; message: string }
      >(functions, 'setupUserAwsSsoConfig');

      const result = await setupUserAwsSsoConfig(config);
      
      // Refresh configuration
      const getUserAwsSsoConfig = httpsCallable<void, AwsSsoConfig>(
        functions, 
        'getUserAwsSsoConfig'
      );
      const configResult = await getUserAwsSsoConfig();
      setAwsSsoConfig(configResult.data);

      return result.data;
    } catch (error) {
      console.error('AWS SSO Setup Error:', error);
      throw error;
    }
  }, [currentUser]);

  // Initiate AWS SSO Login
  const login = useCallback(async () => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      setIsSsoLoading(true);
      setAuthStatus(null);

      // Call Firebase function to initiate SSO login
      const initiateUserAwsSsoLogin = httpsCallable<
        void, 
        SsoSessionInfo
      >(functions, 'initiateUserAwsSsoLogin');

      const result = await initiateUserAwsSsoLogin();
      const { sessionId, userCode, verificationUri } = result.data;

      // Open verification URL in a new window
      window.open(verificationUri, '_blank', 'width=600,height=600');

      // Start polling for login status
      await pollLoginStatus(sessionId);
    } catch (error) {
      console.error('AWS SSO Login Error:', error);
      setIsSsoLoading(false);
      
      // Handle configuration setup requirement
      if (error.details?.requiresSetup) {
        setAuthStatus({
          status: 'failed',
          requiresSetup: true,
          error: 'AWS SSO configuration required'
        });
      } else {
        setAuthStatus({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Login failed'
        });
      }
      throw error;
    }
  }, [currentUser]);

  // Poll login status
  const pollLoginStatus = useCallback(async (sessionId: string) => {
    const pollAwsSsoLoginStatus = httpsCallable<
      { sessionId: string }, 
      SsoStatusResponse
    >(functions, 'pollAwsSsoLoginStatus');

    const maxAttempts = 60; // 5 minutes (60 * 5 seconds)
    let attempts = 0;

    return new Promise<void>((resolve, reject) => {
      const intervalId = setInterval(async () => {
        try {
          const result = await pollAwsSsoLoginStatus({ sessionId });

          attempts++;

          switch (result.data.status) {
            case 'authorized':
              clearInterval(intervalId);
              setIsAuthenticated(true);
              setAuthStatus({
                status: 'authorized',
                identity: result.data.identity
              });
              setIsSsoLoading(false);
              resolve();
              break;
            case 'pending':
              if (attempts >= maxAttempts) {
                clearInterval(intervalId);
                throw new Error('Login timeout');
              }
              break;
          }
        } catch (error) {
          clearInterval(intervalId);
          setIsAuthenticated(false);
          setAuthStatus({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Login failed'
          });
          setIsSsoLoading(false);
          reject(error);
        }
      }, 5000); // Poll every 5 seconds
    });
  }, []);

  return {
    login,
    setupAwsSso,
    isAuthenticated,
    isCheckingAuth,
    isSsoLoading,
    authStatus,
    awsSsoConfig
  };
}