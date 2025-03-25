// src/hooks/useAwsAuth.ts
import { useState, useEffect } from 'react';
import type { AwsAuthStatus } from '../types';

const API_BASE_URL = 'http://localhost:3005';

export const useAwsAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authStatus, setAuthStatus] = useState<AwsAuthStatus>({
    isAuthenticated: false,
    error: undefined
  });

  const checkStatus = async () => {
    console.log('Checking AWS authentication status...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/aws-status`);
      
      console.log('AWS status response:', res);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch authentication status: ${res.status} ${res.statusText}`);
      }
      
      const data: AwsAuthStatus = await res.json();
      console.log('AWS status data:', data);
      
      setIsAuthenticated(data.isAuthenticated);
      setAuthStatus(data);
    } catch (err) {
      console.error('Authentication check failed:', err);
      setIsAuthenticated(false);
      setAuthStatus({
        isAuthenticated: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const login = async () => {
    console.log('Attempting AWS login...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/aws-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      console.log('AWS login response:', response);
      
      if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('AWS login data:', data);
      
      await checkStatus();
    } catch (error) {
      console.error('Login error:', error);
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 300000);
    return () => clearInterval(interval);
  }, []);

  return { 
    isAuthenticated, 
    isCheckingAuth,
    authStatus,
    login
  };
};