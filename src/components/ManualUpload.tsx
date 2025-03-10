// src/components/ManualUpload.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFileUpload } from '../hooks/useFileUpload';

// Using named export to match your import in App.tsx
export const ManualUpload: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { uploadFile, isUploading, uploadError: hookError } = useFileUpload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.txt') && !file.name.endsWith('.log')) {
        setError('Only .txt and .log files are supported');
        setSelectedFile(null);
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size exceeds the 10MB limit');
        setSelectedFile(null);
        return;
      }
      
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!currentUser) {
      setError('You must be logged in to upload files');
      return;
    }
    
    if (!selectedFile) {
      setError('Please select a log file to upload');
      return;
    }

    try {
      const result = await uploadFile(selectedFile);
      if (result) {
        // Navigate to log analysis page after successful upload
        navigate('/log-analysis');
      } else {
        setError(hookError || 'Failed to upload logs. Please try again.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('An unexpected error occurred during upload');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900 flex flex-col">
      {/* Header */}
      <header className="p-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-blue-400 hover:text-blue-300 transition"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Home
        </button>
      </header>
      
      {/* Main Content */}
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/10 rounded-2xl p-8 shadow-xl border border-white/20">
          <div className="flex items-center justify-center mb-6">
            <FileText className="w-12 h-12 text-blue-400 mr-3" />
            <h2 className="text-2xl font-semibold text-white">Upload Logs</h2>
          </div>
          
          <div className="text-gray-300 text-sm mb-6">
            Upload a log file (.txt or .log) to analyze. Maximum file size is 10MB.
          </div>

          <div className="mb-6">
            <input
              type="file"
              id="logFile"
              className="hidden"
              onChange={handleFileChange}
              accept=".log,.txt"
            />
            <label 
              htmlFor="logFile"
              className={`
                w-full flex items-center justify-center p-6 border-2 border-dashed 
                rounded-lg cursor-pointer transition
                ${selectedFile 
                  ? 'border-green-500/50 bg-green-500/10' 
                  : 'border-blue-500/30 hover:border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10'}
              `}
            >
              <Upload className={`w-6 h-6 mr-2 ${selectedFile ? 'text-green-400' : 'text-blue-400'}`} />
              <span className="text-gray-300">
                {selectedFile ? selectedFile.name : 'Choose a log file (.txt only)'}
              </span>
            </label>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4 flex items-start">
              <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className={`
              w-full py-3 rounded-lg transition flex items-center justify-center
              ${!selectedFile || isUploading
                ? 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'}
            `}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              'Upload Logs'
            )}
          </button>
          
          {selectedFile && (
            <div className="mt-4 text-xs text-gray-400 text-center">
              File size: {(selectedFile.size / 1024).toFixed(2)} KB
            </div>
          )}
        </div>
      </div>
    </div>
  );
};