import { useState } from 'react';
import type { LogEntry } from '@/types';

export const useLogUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadLogs = async (file: File): Promise<boolean> => {
    if (!file) return false;
    setIsUploading(true);
    
    try {
      const text = await file.text();
      
      // More robust log parsing
      const logs: LogEntry[] = text.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          // Try multiple parsing strategies
          try {
            // Strategy 1: Timestamp - Message format
            const [timestamp, ...messageParts] = line.split(' - ');
            const message = messageParts.join(' - ');
            
            return {
              timestamp: new Date(timestamp).toISOString(),
              message: message || line,
              logStream: 'manual-upload',
              severity: determineSeverity(message || line)
            };
          } catch (parseError) {
            // Fallback strategy: use entire line
            return {
              timestamp: new Date().toISOString(),
              message: line,
              logStream: 'manual-upload',
              severity: determineSeverity(line)
            };
          }
        })
        .filter(log => log.message.trim() !== '');

      // Ensure we have some logs
      if (logs.length === 0) {
        console.error('No valid logs found in the file');
        return false;
      }

      // Detailed logging for debugging
      console.log('Parsed Logs:', logs);

      // Store logs with careful size management
      try {
        // Limit logs and stringify
        const logsToStore = logs.slice(0, 100000);
        const logsString = JSON.stringify(logsToStore);

        // Ensure we don't exceed storage limits
        if (new Blob([logsString]).size < 4.5 * 1024 * 1024) { // Under 4.5MB
          sessionStorage.setItem('manualLogs', logsString);
          sessionStorage.setItem('logSource', 'manual');
          console.log('Logs stored successfully:', logsToStore.length);
        } else {
          // Store only recent logs if too large
          const recentLogs = logsToStore.slice(-500);
          sessionStorage.setItem('manualLogs', JSON.stringify(recentLogs));
          sessionStorage.setItem('logSource', 'manual');
          console.warn('Stored only recent logs due to size limitations');
        }

        return true;
      } catch (storageError) {
        console.error('Storage error:', storageError);
        return false;
      }
    } catch (error) {
      console.error('Error processing file:', error);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  // Helper function to determine severity
  const determineSeverity = (message: string): 'info' | 'warning' | 'error' => {
    const lowercaseMessage = message.toLowerCase();
    if (lowercaseMessage.includes('error')) return 'error';
    if (lowercaseMessage.includes('warn')) return 'warning';
    return 'info';
  };

  return { uploadLogs, isUploading };
};