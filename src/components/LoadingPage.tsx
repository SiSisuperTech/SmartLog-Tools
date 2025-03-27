import React, { useEffect, useState } from 'react';

interface LoadingPageProps {
  message?: string;
  showProgress?: boolean;
  isLoading?: boolean;
  onComplete?: () => void;
  delay?: number;
}

const LoadingPage: React.FC<LoadingPageProps> = ({ 
  message = 'Loading Data...', 
  showProgress = false, 
  isLoading = true,
  onComplete,
  delay = 1000 
}) => {
  const [progress, setProgress] = useState(0);
  const [dots, setDots] = useState('');
  
  // Animation for the loading dots
  useEffect(() => {
    if (!isLoading) return;
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    
    return () => clearInterval(interval);
  }, [isLoading]);
  
  // Simulated progress animation
  useEffect(() => {
    if (!isLoading || !showProgress) return;
    
    const interval = setInterval(() => {
      setProgress(prev => {
        // Accelerate as it gets closer to 100%
        const increment = prev < 30 ? 1 : prev < 60 ? 0.7 : prev < 90 ? 0.4 : 0.1;
        const newValue = Math.min(prev + increment, 99);
        return newValue;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [isLoading, showProgress]);
  
  // Auto-completion after certain time
  useEffect(() => {
    if (!isLoading) return;
    
    const timer = setTimeout(() => {
      if (onComplete) {
        setProgress(100);
        onComplete();
      }
    }, delay);
    
    return () => clearTimeout(timer);
  }, [isLoading, delay, onComplete]);

  if (!isLoading) return null;
  
  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm transition-all duration-300"
      style={{ animation: 'fadeIn 0.3s ease-out' }}
    >
      <div className="flex flex-col items-center justify-center px-6 py-8 max-w-md text-center">
        {/* Logo */}
        <div className="relative mb-8">
          <img 
            src="/logo.png" 
            alt="Company Logo" 
            className="w-32 h-32 object-contain animate-pulse"
            style={{ animation: 'pulse 2s infinite ease-in-out' }}
          />
          <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-20 h-2 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent rounded-full blur-md animate-pulse"></div>
        </div>
        
        {/* Loading Message */}
        <h2 className="text-xl font-semibold text-white mb-3">
          {message}{dots}
        </h2>
        
        {/* Sub message */}
        <p className="text-slate-400 text-sm mb-6">
          Please wait while we prepare your data
        </p>
        
        {/* Loading Spinner */}
        <div className="relative mb-5">
          <div className="w-16 h-16 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-400/30 rounded-full animate-pulse"></div>
        </div>
        
        {/* Progress Bar */}
        {showProgress && (
          <div className="w-64 bg-slate-800 rounded-full h-2 overflow-hidden mt-4">
            <div 
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
      
      {/* CSS animations */}
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.05); opacity: 1; }
            100% { transform: scale(1); opacity: 0.8; }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingPage; 