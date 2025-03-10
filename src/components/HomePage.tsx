// src/components/HomePage.tsx
import React from 'react';
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
  LogOut,
  User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
  const { currentUser, signOut } = useAuth();

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
        
        <div className="flex items-center space-x-6">
          {/* Google Auth Status */}
          {currentUser && (
            <div className="flex items-center text-green-400">
              {currentUser.photoURL ? (
                <img 
                  src={currentUser.photoURL} 
                  alt="Profile" 
                  className="w-8 h-8 rounded-full mr-2 border border-green-400"
                />
              ) : (
                <User className="w-6 h-6 mr-2 border border-green-400 rounded-full p-1" />
              )}
              <span className="mr-2 hidden md:inline">{currentUser.email}</span>
              <button 
                onClick={() => signOut()}
                className="text-red-400 hover:text-red-300 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
          
          {/* AWS Auth Status */}
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
        <div className="max-w-4xl w-full grid md:grid-cols-2 gap-8">
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
        </div>
      </main>

      {/* Authentication Section */}
      {!isAuthenticated && (
        <div className="p-6 text-center">
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
      )}

      {/* Footer */}
      <footer className="p-6 text-center text-gray-400">
         sisi v1.0.0
      </footer>
    </div>
  );
};