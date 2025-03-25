// src/components/HomePage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  Search, 
  FileText, 
  Server, 
  Wrench,
  Cctv,
  Lock, 
  Unlock,
  Monitor // Added Monitor icon for the new card
} from 'lucide-react';
import { fetchClinics } from '../api/clinicApi';
import { ClinicMonitoringConfig } from '../types/clinic-types';

interface HomePageProps {
  isAuthenticated: boolean | null;
  isCheckingAuth: boolean;
  onAwsLogin: () => Promise<void>;
}

export const HomePage: React.FC<HomePageProps> = ({ 
  isAuthenticated, 
  isCheckingAuth, 
  onAwsLogin 
}) => {
  const navigate = useNavigate();
  // Add state to track monitored clinics
  const [monitoredClinics, setMonitoredClinics] = useState<ClinicMonitoringConfig[]>([]);
  const [isLoadingClinics, setIsLoadingClinics] = useState(false);

  // Add useEffect to fetch clinics when component mounts
  useEffect(() => {
    const loadClinics = async () => {
      setIsLoadingClinics(true);
      try {
        // First try to get clinics from API
        const clinics = await fetchClinics();
        setMonitoredClinics(clinics);
      } catch (error) {
        console.error('Failed to load clinics from API:', error);
        // Fall back to localStorage if API fails
        try {
          const stored = localStorage.getItem('monitoredClinics');
          if (stored) {
            setMonitoredClinics(JSON.parse(stored));
          }
        } catch (localStorageError) {
          console.error('Failed to load from localStorage:', localStorageError);
          setMonitoredClinics([]);
        }
      } finally {
        setIsLoadingClinics(false);
      }
    };

    loadClinics();

    // Add an event listener to reload clinics when window gains focus
    const handleFocus = () => {
      console.log('Window focused, refreshing clinics');
      loadClinics();
    };

    window.addEventListener('focus', handleFocus);

    // Clean up the event listener when component unmounts
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const ActionCard: React.FC<{
    icon: React.ElementType;
    title: string;
    description: string;
    onClick: () => void;
    disabled?: boolean;
  }> = ({ icon: Icon, title, description, onClick, disabled = false }) => (
    <div 
      onClick={!disabled ? onClick : undefined}
      className={`
        bg-white/10 rounded-2xl p-6 
        border border-white/20 
        hover:bg-white/20 
        transition-all duration-300
        cursor-pointer
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div className="flex items-center mb-4">
        <Icon className="w-10 h-10 mr-4 text-blue-400" />
        <h3 className="text-xl font-semibold text-white">{title}</h3>
      </div>
      <p className="text-gray-300">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <div className="flex items-center">
          <Cctv className="w-8 h-8 mr-3 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Log Analysis Hub</h1>
          <span className="ml-3 px-2 py-1 bg-blue-500/20 text-yellow-300 rounded-full text-xs">BETA</span>
        </div>
        <div className="flex items-center space-x-3">
          {isAuthenticated !== null && (
            <div 
              className={`
                flex items-center 
                ${isAuthenticated ? 'text-green-400' : 'text-red-400'}
              `}
            >
              {isAuthenticated ? <Unlock className="mr-2" /> : <Lock className="mr-2" />}
              {isAuthenticated ? 'AWS Connected' : 'AWS Not Connected'}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center p-6">
        <div className="max-w-4xl w-full grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* AWS CloudWatch Query */}
          <ActionCard 
            icon={Search}
            title="CloudWatch Log Query"
            description="Retrieve and analyze logs directly from AWS CloudWatch"
            onClick={() => navigate('/log-query')}
            disabled={!isAuthenticated}
          />

          {/* Manual Upload */}
          <ActionCard 
            icon={Upload}
            title="Manual Log Upload"
            description="Upload and analyze log files from your local machine"
            onClick={() => navigate('/manual-upload')}
          />

          {/* Clinic Monitoring - New card */}
          <ActionCard 
            icon={Monitor}
            title="Clinic Monitoring"
            description="Monitor dental X-ray systems across multiple clinics with automated alerts"
            onClick={() => navigate('/monitoring')}
          />
        </div>
      </main>

      {/* AWS Authentication Section */}
      {!isAuthenticated && (
        <div className="p-6 max-w-lg mx-auto w-full">
          <h2 className="text-xl font-semibold text-white mb-4 text-center">
            AWS Authentication Required
          </h2>
          <div className="bg-white/10 p-6 rounded-xl border border-white/20 text-center">
            <p className="text-gray-300 mb-4">You need to authenticate with AWS to access CloudWatch logs.</p>
            <button 
              onClick={onAwsLogin}
              disabled={isCheckingAuth}
              className={`
                bg-blue-600 text-white 
                px-6 py-3 rounded-lg 
                hover:bg-blue-700 
                transition-colors
                ${isCheckingAuth ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {isCheckingAuth ? 'Checking Authentication...' : 'Login to AWS'}
            </button>
          </div>
        </div>
      )}

      {/* Display monitored clinics if available */}
      {monitoredClinics.length > 0 && (
        <div className="p-6 max-w-4xl mx-auto w-full">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Monitor className="w-5 h-5 mr-2 text-blue-400" />
            Monitored Clinics
            {isLoadingClinics && <span className="ml-2 text-sm text-slate-400">(Refreshing...)</span>}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {monitoredClinics.map((clinic) => (
              <div 
                key={clinic.id}
                className="bg-white/10 rounded-lg p-4 border border-white/20 cursor-pointer hover:bg-white/20 transition"
                onClick={() => navigate('/monitoring')}
              >
                <div className="flex items-center mb-2">
                  <Monitor className="w-5 h-5 mr-2 text-blue-400" />
                  <h3 className="font-medium text-white">{clinic.name}</h3>
                </div>
                <div className="text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span>Last check:</span>
                    <span>{clinic.lastRun ? new Date(clinic.lastRun).toLocaleDateString() : 'Never'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={`
                      ${clinic.status === 'inactive' ? 'text-red-400' : 
                        clinic.status === 'warning' ? 'text-yellow-400' : 
                        'text-green-400'}
                    `}>
                      {clinic.status === 'inactive' ? 'Critical' : 
                       clinic.status === 'warning' ? 'Warning' : 
                       'Healthy'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="p-6 text-center text-gray-400">
        sisi v1.0.0
      </footer>
    </div>
  );
};