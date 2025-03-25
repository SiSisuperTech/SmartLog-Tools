import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './components/HomePage';
import LogQueryPage from './pages/LogQueryPage';
import { ManualUpload } from './components/ManualUpload';
import { useAwsAuth } from './hooks/useAwsAuth';
import LogAnalysisPage from './pages/LogAnalysisPage';
import ClinicMonitoringDashboard from './pages/ClinicMonitoringDashboard';
import DentalXrayMonitoring from './pages/DentalXrayMonitoring';

/**
 * Main App component that handles routing for the dental X-ray monitoring system
 */
const App: React.FC = () => {
  const { isAuthenticated, isCheckingAuth, login } = useAwsAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            <HomePage 
              isAuthenticated={isAuthenticated}
              isCheckingAuth={isCheckingAuth}
              onAwsLogin={login}
            />
          } 
        />
        <Route path="/log-query" element={<LogQueryPage />} />
        <Route path="/manual-upload" element={<ManualUpload />} />
        <Route path="/log-analysis" element={<LogAnalysisPage />} />
        <Route path="/monitoring" element={<ClinicMonitoringDashboard />} />
        <Route path="/dental-xray-monitoring" element={<DentalXrayMonitoring />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;