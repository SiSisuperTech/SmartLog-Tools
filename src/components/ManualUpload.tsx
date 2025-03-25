// src/components/ManualUpload.tsx
import React, { useState } from 'react';
import { useLogUpload } from '../hooks/useLogUpload'; // Adjust path as needed
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2 } from 'lucide-react';

// Change from default export to named export
export const ManualUpload: React.FC = () => {
  const navigate = useNavigate();
  const { uploadLogs, isUploading } = useLogUpload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a log file to upload');
      return;
    }

    try {
      const success = await uploadLogs(selectedFile);
      if (success) {
        // Navigate to log analysis page after successful upload
        navigate('/log-analysis');
      } else {
        setError('Failed to upload logs. Please try again.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('An unexpected error occurred during upload');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
        <div className="flex items-center justify-center mb-6">
          <FileText className="w-12 h-12 text-blue-400 mr-3" />
          <h2 className="text-2xl font-semibold text-white">Upload Logs , (.txt only) </h2>
          
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
            className="w-full flex items-center justify-center p-4 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 transition"
          >
            <Upload className="w-6 h-6 mr-2 text-slate-400" />
            <span className="text-slate-300">
              {selectedFile ? selectedFile.name : 'Choose a log file'}
            </span>
          </label>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 text-red-300 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className={`
            w-full py-3 rounded-lg transition flex items-center justify-center
            ${!selectedFile || isUploading 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
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

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-white transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};