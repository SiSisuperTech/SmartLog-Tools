// src/hooks/useFileUpload.ts
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface UploadResult {
  id: string;
  fileName: string;
  url: string;
  contentType: string;
  size: number;
}

interface UploadRequest {
  fileName: string;
  contentType: string;
  base64Content: string;
}

export const useFileUpload = () => {
  const { currentUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const uploadFile = async (file: File): Promise<UploadResult | null> => {
    if (!currentUser) {
      setUploadError('Must be logged in to upload files');
      return null;
    }
    
    // Security: Validate file size client-side
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large (max 10MB)');
      return null;
    }
    
    // Security: Validate file type client-side
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/json', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type');
      return null;
    }
    
    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      
      // Read file as base64
      const reader = new FileReader();
      
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress((event.loaded / event.total) * 50); // First 50% is reading
          }
        };
        reader.readAsDataURL(file);
      });
      
      // Extract base64 content (remove data URL prefix)
      const base64Content = fileData.split(',')[1];
      
      // Call Firebase function to handle upload
      const functions = getFunctions();
      const handleFileUpload = httpsCallable<UploadRequest, UploadResult>(
        functions, 
        'handleFileUpload'
      );
      
      // Upload to Firebase
      setUploadProgress(75); // Reading complete, now uploading
      const result = await handleFileUpload({
        fileName: file.name,
        contentType: file.type,
        base64Content
      });
      
      setUploadProgress(100);
      return result.data;
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'File upload failed');
      return null;
    } finally {
      setIsUploading(false);
    }
  };
  
  return {
    uploadFile,
    isUploading,
    uploadProgress,
    uploadError
  };
};