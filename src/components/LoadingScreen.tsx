import React from 'react';
import { RefreshCw } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

/**
 * A full-screen loading component with animated elements
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading data...' }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="flex flex-col items-center max-w-md px-6 py-8 text-center">
        {/* App name with style */}
        <h1 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400 mb-2">
          DentalMonitor Pro
        </h1>
        
        {/* Subtitle with dental reference */}
        <p className="text-lg text-gray-300 mb-8">X-ray Monitoring System</p>
        
        {/* Loading icon animation */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-blue-500/20"></div>
          </div>
          <RefreshCw 
            size={40} 
            className="text-blue-400 animate-spin" 
            style={{ animationDuration: '3s' }} 
          />
        </div>
        
        {/* Loading message */}
        <p className="text-gray-400 text-lg animate-pulse">{message}</p>
        
        {/* Footer text */}
        <p className="text-gray-500 text-sm mt-8">
          Preparing your clinical data...
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
