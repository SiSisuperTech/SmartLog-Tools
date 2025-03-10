// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './components/HomePage';
import LogQueryPage from './pages/LogQueryPage';
import { ManualUpload } from './components/ManualUpload';
import { useAwsAuth } from './hooks/useAwsAuth';
import LogAnalysisPage from './pages/LogAnalysisPage';
import LoginComponent from './components/LoginComponent';
import { useAuth } from './contexts/AuthContext';

// Protected route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const { isAuthenticated, isCheckingAuth, login } = useAwsAuth();
  const { currentUser } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Default Route - Redirects based on authentication */}
        <Route 
          path="/" 
          element={
            currentUser ? 
              <Navigate to="/home" replace /> : 
              <Navigate to="/login" replace />
          } 
        />

        {/* Login Route */}
        <Route 
          path="/login" 
          element={
            currentUser ? 
              <Navigate to="/home" replace /> : 
              <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                  <LoginComponent />
                </div>
              </div>
          } 
        />
        
        {/* Protected Home Route */}
        <Route 
          path="/home" 
          element={
            <ProtectedRoute>
              <HomePage 
                isAuthenticated={isAuthenticated}
                isCheckingAuth={isCheckingAuth}
                onAwsLogin={login}
              />
            </ProtectedRoute>
          } 
        />
        
        {/* Other Protected Routes */}
        <Route 
          path="/log-query" 
          element={
            <ProtectedRoute>
              <LogQueryPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/manual-upload" 
          element={
            <ProtectedRoute>
              <ManualUpload />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/log-analysis" 
          element={
            <ProtectedRoute>
              <LogAnalysisPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Catch-all route redirects to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;