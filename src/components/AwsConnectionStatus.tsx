import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';

// Define the return type of the function
interface AwsConnectionResponse {
  isAuthenticated: boolean;
  identity?: string;
  error?: string;
}

function AwsConnectionStatus() {
  const { currentUser } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState('checking'); // 'checking', 'connected', 'disconnected'
  const [isPolling, setIsPolling] = useState(false);
  
  // Check AWS connection status
  const checkConnection = async () => {
    if (!currentUser) {
      setConnectionStatus('disconnected');
      return false;
    }

    try {
      setConnectionStatus('checking');
      
      const functions = getFunctions();
      const checkAwsStatus = httpsCallable<{}, AwsConnectionResponse>(functions, 'systemCheckAwsConnection');
      const result = await checkAwsStatus({});
      
      if (result.data.isAuthenticated) {
        setConnectionStatus('connected');
        return true;
      } else {
        setConnectionStatus('disconnected');
        return false;
      }
    } catch (error) {
      console.error('Failed to check AWS connection:', error);
      setConnectionStatus('disconnected');
      return false;
    }
  };
  
  // Start polling for connection status
  const startConnectionPolling = () => {
    setIsPolling(true);
    
    // Check every 5 seconds until connected
    const intervalId = setInterval(async () => {
      const isConnected = await checkConnection();
      if (isConnected) {
        clearInterval(intervalId);
        setIsPolling(false);
      }
    }, 5000);
    
    // Stop polling after 2 minutes if not connected
    setTimeout(() => {
      clearInterval(intervalId);
      setIsPolling(false);
    }, 120000);
    
    return () => clearInterval(intervalId);
  };
  
  // Check connection on component mount
  useEffect(() => {
    checkConnection();
  }, [currentUser]);
  
  // Different states based on connection status
  if (connectionStatus === 'checking') {
    return <div>Checking AWS connection...</div>;
  }
  
  if (connectionStatus === 'connected') {
    return <div>Connected to AWS! You can now use the application.</div>;
  }
  
  // Not connected - show instructions
  return (
    <div className="aws-connection-notice">
      <h3>AWS Connection Required</h3>
      
      <div className="connection-instructions">
        <p>Please run this command in your terminal:</p>
        <div className="command-box">
          <code>aws sso login --profile default</code>
          <button className="copy-button">Copy</button>
        </div>
        
        <button 
          onClick={startConnectionPolling}
          disabled={isPolling}
        >
          {isPolling ? "Checking for connection..." : "Check Connection"}
        </button>
        
        {isPolling && (
          <p>Waiting for AWS connection to be established...</p>
        )}
      </div>
    </div>
  );
}
export default AwsConnectionStatus;