import React, { useState, useEffect, useCallback, useRef, ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClinicSaving } from '../hooks/useClinicSaving';
import { 
  Monitor, 
  Bell, 
  Clock, 
  Slack, 
  Plus, 
  Trash2, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Settings, 
  Calendar,
  Maximize2,
  Minimize2,
  PlayCircle,
  PauseCircle,
  Search,
  ChevronLeft,
  Camera,
  FileText,
  Download,
  Upload,
  Server,
  Eye
} from 'lucide-react';
import locationData from 'C:/Users/SISI/Documents/SmartLog-Tools/data.json'
import { 
  fetchClinics, 
  addClinic as addClinicApi, 
  updateClinic as updateClinicApi, 
  deleteClinic as deleteClinicApi,
  resetAllClinics as resetAllClinicsApi
} from '../api/clinicApi';
import { ClinicMonitoringConfig, MonitoringSummary, TreatmentInfo as BaseTreatmentInfo } from '../types/clinic-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, LineChart } from 'recharts';

// Extend the TreatmentInfo interface to include additional properties used locally
interface TreatmentInfo extends BaseTreatmentInfo {
  id?: string;
  locationId?: string;
  originalLog?: string | Record<string, any>; // Add originalLog property to store the original log entry
}

// Create a local extended MonitoringSummary type that uses our extended TreatmentInfo
interface ExtendedMonitoringSummary extends Omit<MonitoringSummary, 'treatments'> {
  treatments: TreatmentInfo[];
}

// Import types from DentalXrayMonitoring
interface LogEntry {
  timestamp: string;
  message: string;
  logStream?: string;
  severity: 'info' | 'warning' | 'error';
  id?: string;
}

// Create global vars outside component to persist across renders/state changes
// These will persist even when the component re-renders
const globalLastAwsCheck = {
  timestamp: 0,
  isAuthenticated: false,
  lastCheckTime: 0
};

// In-memory cache for X-ray data by location
let xrayDataCache: Record<string, TreatmentInfo[]> = {};

const ClinicMonitoringDashboard = () => {
  const navigate = useNavigate();
  const { saveMonitoredClinics } = useClinicSaving();
  
  // Core state
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [monitoredClinics, setMonitoredClinics] = useState<ClinicMonitoringConfig[]>([]);
  const [clinicSummaries, setClinicSummaries] = useState<ExtendedMonitoringSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<ClinicMonitoringConfig | null>(null);
  const [availableClinics, setAvailableClinics] = useState<{id: string, name: string}[]>([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [configError, setConfigError] = useState<string | null>(null);
  const [monitoringClinic, setMonitoringClinic] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');
  const [isConnectedToAws, setIsConnectedToAws] = useState(false);
  const [awsLoginInProgress, setAwsLoginInProgress] = useState(false);
  const [justLoaded, setJustLoaded] = useState(true);
  
  // Schedule options
  const scheduleOptions = [
    { value: 'hourly', label: 'Every hour' },
    { value: 'daily', label: 'Daily (00:00 UTC)' },
    { value: 'weekly', label: 'Weekly (Sunday 00:00 UTC)' }
  ];

  // Add this helper function near the top of the component, before useEffect hooks
  // This function will convert a clinic with panoThreshold to one without it
  const stripPanoThreshold = (clinic: any): ClinicMonitoringConfig => {
    // Clone the clinic object without the panoThreshold in case it's set to 0
    const { panoThreshold, ...cleanedClinic } = clinic;
    return {
      ...cleanedClinic,
      panoThreshold: panoThreshold !== undefined ? panoThreshold : 15 // Default value if undefined
    };
  };

  // Function to load monitored clinics from the API
  const loadMonitoredClinics = useCallback(async () => {
    try {
      console.log('Loading monitored clinics from API');
      const clinics = await fetchClinics();
      console.log(`Loaded ${clinics.length} clinics from API`);
      return clinics;
    } catch (error) {
      console.error('Failed to load monitored clinics from API:', error);
      // Fallback to localStorage if API fails
      try {
        console.log('Falling back to localStorage');
      const stored = localStorage.getItem('monitoredClinics');
      if (stored) {
          const parsedClinics = JSON.parse(stored);
          console.log(`Loaded ${parsedClinics.length} clinics from localStorage`);
          return parsedClinics;
        }
      } catch (localStorageError) {
        console.error('Failed to load from localStorage:', localStorageError);
      }
      return [];
    }
  }, []);

  // Mock function to fetch available clinics (would be API call in real app)
  const fetchAvailableClinics = useCallback(async () => {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Map the locationData from data.json to the expected format
      return locationData.map(location => ({
        id: location.ID.toString(),
        name: location.Title
      }));
    } catch (error) {
      console.error('Error fetching available clinics:', error);
      return [];
    }
  }, []);

  // Function to check if no panos for 5 hours, taking into account business hours
  const hasNoPanosForFiveHours = (lastPanoTime: string | null, locationId: string): boolean => {
    if (!lastPanoTime) return true;
    
    const lastPanoDate = new Date(lastPanoTime);
    const now = new Date();
    
    // Get the day of the week (0 = Sunday, 1 = Monday, etc.)
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    
    // Define business hours (9 AM to 5 PM, Monday to Friday)
    const isBusinessHours = currentDay >= 1 && currentDay <= 5 && currentHour >= 9 && currentHour < 17;
    
    // If it's outside business hours, don't count it as inactive
    if (!isBusinessHours) {
      console.log(`Outside business hours for location ${locationId} - Current time: ${currentHour}:00`);
      return false;
    }
    
    // Use the timestamp directly without timezone conversion
    const fiveHoursAgo = new Date();
    fiveHoursAgo.setHours(fiveHoursAgo.getHours() - 5);
    
    return lastPanoDate < fiveHoursAgo;
  };

  // Function to determine status based on X-ray activity and business hours
  const determineStatus = (totalXrays: number, lastActivityTime: string | null, locationId: string): 'inactive' | 'active' | 'warning' => {
    const noActivityForFiveHours = hasNoPanosForFiveHours(lastActivityTime, locationId);
    
    if (totalXrays > 0) {
      return noActivityForFiveHours ? 'warning' : 'active';
    }
    return 'inactive';
  };

  // Add this helper function to extract X-ray data from logs
  const extractXrayDataFromLogs = useCallback((logEntries: LogEntry[]): TreatmentInfo[] => {
    // Array to store valid treatments
    const extractedTreatments: TreatmentInfo[] = [];
    
    // Regular expression to match the exact treatment creation message pattern
    // Pattern looks for: createTreatment: Treatment created successfully for [patient name with asterisks]
    const treatmentRegex = /createTreatment: Treatment created successfully for ([A-Za-z*]+(?: [A-Za-z*]+)+)/;
    
    console.log(`Analyzing ${logEntries.length} log entries for treatment data`);
    
    // Filter logs that specifically match our pattern
    const treatmentLogs = logEntries.filter(log => 
      log.message.includes('createTreatment') && 
      log.message.includes('Treatment created successfully for')
    );
    
    console.log(`Found ${treatmentLogs.length} logs matching treatment creation pattern`);
    
    treatmentLogs.forEach((log, index) => {
      const messageMatch = log.message.match(treatmentRegex);
      
      // Only count as a valid treatment if it matches the pattern
      if (messageMatch) {
        const patientName = messageMatch[1];
        
        // Verify the name follows the pattern with asterisks (masked names)
        if (/[A-Za-z*]+\s+[A-Za-z*]+/.test(patientName)) {
          // Determine if this is a panoramic X-ray by checking the message content
          const isPano = log.message.toLowerCase().includes('panoramic') || 
                        log.message.toLowerCase().includes('pano') ||
                        log.message.toLowerCase().includes('panorama');
          
          extractedTreatments.push({
            timestamp: log.timestamp,
            patientId: `patient-${index}`,
            patientName,
            type: isPano ? 'PANORAMIC' : 'PERIAPICAL',
            success: true, // Since we're only matching successful treatments
            id: `treatment-${log.id || Date.now()}-${index}`,
            locationId: log.logStream,
            originalLog: log // Store the original log entry for reference
          });
        }
      }
    });
    
    // Sort by timestamp, newest first
    extractedTreatments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Log the counts for debugging
    const totalXrays = extractedTreatments.length;
    const panosTaken = extractedTreatments.filter(t => t.type === 'PANORAMIC').length;
    console.log(`Extracted ${totalXrays} total X-rays, including ${panosTaken} panoramic X-rays`);
    
    return extractedTreatments;
  }, []);

  // Add a function to fetch logs that will be used to extract X-ray data
  const fetchLogData = useCallback(async (): Promise<LogEntry[]> => {
    try {
      // In a real implementation, this would fetch logs from an API
      // For now, check if we have logs in sessionStorage from the DentalXrayMonitoring page
      
      // Look for logs in session storage
      const source = sessionStorage.getItem('logSource');
      let storedLogs: LogEntry[] = [];
      
      if (source) {
        // Try different storage formats
        if (source === 'manual') {
          // Load manually uploaded logs
          const logStorage = sessionStorage.getItem('manualLogs');
          if (logStorage) {
            try {
              const parsed = JSON.parse(logStorage);
              storedLogs = Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
              console.error('Error parsing logs:', e);
            }
          }
        } 
        else if (source === 'query' || source === 'direct' || source === 'aws') {
          // Load query results
          const queryResults = sessionStorage.getItem(`${source}Logs`);
          if (queryResults) {
            try {
              const parsed = JSON.parse(queryResults);
              // Handle different result formats
              if (Array.isArray(parsed)) {
                storedLogs = parsed;
              } else if (parsed.results && Array.isArray(parsed.results)) {
                storedLogs = parsed.results;
              }
            } catch (e) {
              console.error('Error parsing logs:', e);
            }
          }
        }
      }
      
      if (storedLogs.length === 0) {
        console.log('No logs found in sessionStorage, will use simulated data');
      } else {
        console.log(`Found ${storedLogs.length} log entries in sessionStorage`);
        
        // Normalize logs to ensure they have all required fields
        storedLogs = storedLogs.map(log => ({
          timestamp: log.timestamp || new Date().toISOString(),
          message: log.message || 'No message',
          severity: log.severity || 'info',
          logStream: log.logStream || '',
          id: log.id || `log-${Date.now()}-${Math.random().toString(36).slice(2)}`
        }));
        
        // Store logs in state
        setLogs(storedLogs);
      }
      
      return storedLogs;
    } catch (error) {
      console.error('Error fetching log data:', error);
      return [];
    }
  }, []);

  // Update the loadTreatmentData function to use real log data
  const loadTreatmentData = async (locationId: string, options?: { skipNotifications?: boolean }): Promise<TreatmentInfo[]> => {
    const { skipNotifications = false } = options || {};
    
    try {
      // If we have cached data, return it (for performance)
      if (xrayDataCache[locationId]) {
        console.log(`Using cached treatment data for location ${locationId} (${xrayDataCache[locationId].length} treatments)`);
        return xrayDataCache[locationId];
      }
      
      console.log(`Fetching real treatment data for location ${locationId}${skipNotifications ? ' (notifications disabled)' : ''}`);
      
      // Only attempt to fetch real data if connected to AWS
      if (!isConnectedToAws) {
        console.log('Not connected to AWS, cannot fetch real data');
        return [];
      }
      
      // Get the current time and 24 hours ago for the query
      const endTime = new Date().getTime();
      const startTime = endTime - (24 * 60 * 60 * 1000); // 24 hours ago
      
      // Fetch logs from CloudWatch
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime,
          endTime,
          locationIds: [locationId],
          version: '2.4.5', // Use the correct version or make this configurable
          limit: 1000
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
      }
      
      const logsData = await response.json();
      console.log(`Received log data from API for locationId ${locationId}:`, logsData);
      console.log(`Received ${logsData.results?.length || 0} log entries from AWS`);
      
      // Debug the structure of the first log entry if available
      if (logsData.results && logsData.results.length > 0) {
        console.log('First log entry structure:', JSON.stringify(logsData.results[0], null, 2));
      }
      
      // Parse logs to extract treatment data
      const treatments: TreatmentInfo[] = [];
      
      // Process the log entries to extract treatment information
      if (logsData.results && Array.isArray(logsData.results)) {
        logsData.results.forEach((logEntry: any) => {
          try {
            // Handle different CloudWatch log formats
            // Format 1: Array of field objects [{field: '@timestamp', value: '...'}, {field: '@message', value: '...'}]
            // Format 2: Object with direct properties {timestamp: '...', message: '...'}
            
            let message: string = '';
            let timestamp: string = '';
            
            if (Array.isArray(logEntry)) {
              // Format 1: Array of field objects
              const messageField = logEntry.find((field: any) => field.field === '@message');
              const timestampField = logEntry.find((field: any) => field.field === '@timestamp');
              
              message = messageField?.value || '';
              timestamp = timestampField?.value || new Date().toISOString();
            } else if (typeof logEntry === 'object' && logEntry !== null) {
              // Format 2: Object with direct properties
              message = logEntry.message || logEntry['@message'] || '';
              timestamp = logEntry.timestamp || logEntry['@timestamp'] || new Date().toISOString();
            } else {
              // String format or unexpected format
              console.warn('Unexpected log entry format:', logEntry);
              return; // Skip this entry
            }
            
            // Parse treatment creation messages
            // Example format: "createTreatment: Treatment created successfully for Patient Name (ID: patient-123), type: PANORAMIC"
            const treatmentMatch = message.match(/createTreatment: Treatment created successfully for (.+?) \(ID: (.+?)\), type: (PANORAMIC|PERIAPICAL)/i);
            
            if (treatmentMatch) {
              const patientName = treatmentMatch[1].trim();
              const patientId = treatmentMatch[2].trim();
              const type = treatmentMatch[3].toUpperCase();
              
        treatments.push({
                id: `treatment-${locationId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                patientId,
                patientName,
                type,
                success: true, // Successful treatments
                timestamp: timestamp,
          locationId
              });
            }
            
            // Also look for processed X-ray messages
            const processedMatch = message.match(/Successfully processed (PANORAMIC|PERIAPICAL) X-ray for patient (.+?) \(ID: (.+?)\)/i);
            
            if (processedMatch) {
              const type = processedMatch[1].toUpperCase();
              const patientName = processedMatch[2].trim();
              const patientId = processedMatch[3].trim();
              
              treatments.push({
                id: `treatment-${locationId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                patientId,
                patientName,
                type,
                success: true, // Successful treatments
                timestamp: timestamp,
                locationId
              });
            }
            
            // Also look for failed treatments
            const failedMatch = message.match(/Failed to process (PANORAMIC|PERIAPICAL) X-ray for patient (.+?) \(ID: (.+?)\)/i);
            
            if (failedMatch) {
              const type = failedMatch[1].toUpperCase();
              const patientName = failedMatch[2].trim();
              const patientId = failedMatch[3].trim();
              
              treatments.push({
                id: `treatment-${locationId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                patientId,
                patientName,
                type,
                success: false, // Failed treatments
                timestamp: timestamp,
                locationId
              });
            }
            
            // Inside the try/catch block where we process log entries, after the existing pattern matching
            // Look for X-ray activity with simpler patterns if none of the other patterns match
            if (!treatmentMatch && !processedMatch && !failedMatch) {
              // Generic X-ray activity pattern (matches various log formats)
              const genericXrayMatch = message.match(/(PANORAMIC|PERIAPICAL).+?(patient|Patient).+?(\w+[-\w]*\d+[-\w]*)/i);
              
              if (genericXrayMatch) {
                const type = genericXrayMatch[1].toUpperCase();
                // Extract patient ID (assuming it contains numbers)
                const patientId = genericXrayMatch[3].trim();
                // Use a generic patient name if can't extract specifically
                const patientName = `Patient ${patientId.replace(/\D/g, '')}`;
                
                console.log(`Found generic X-ray activity: ${type} for ${patientName} (${patientId})`);
                
                treatments.push({
                  id: `treatment-${locationId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  patientId,
                  patientName,
                  type,
                  success: !message.toLowerCase().includes('fail') && !message.toLowerCase().includes('error'),
                  timestamp: timestamp,
                  locationId
                });
              }
            }
          } catch (error) {
            console.error('Error processing log entry:', error, logEntry);
          }
        });
      }
      
      // Sort by timestamp (newest first)
      treatments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Set the cache
      xrayDataCache[locationId] = treatments;
      // Save cache to sessionStorage
      sessionStorage.setItem('xrayDataCache', JSON.stringify(xrayDataCache));
      
      console.log(`Parsed ${treatments.length} treatments for location ${locationId} (Pano %: ${Math.round(treatments.filter(t => t.type === 'PANORAMIC').length / treatments.length * 100)}%)`);
      
      // After processing all logs, check if we found any treatments
      if (treatments.length === 0 && logsData.results && logsData.results.length > 0) {
        console.log(`No treatments found in logs for locationId ${locationId}, creating test treatment for debugging`);
        
        // Create a test treatment to help diagnose logs
        const now = new Date();
        treatments.push({
          id: `test-treatment-${locationId}-${Date.now()}`,
          patientId: `debug-patient-${locationId}`,
          patientName: `Test Patient ${locationId}`,
          type: 'PANORAMIC',
          success: true,
          timestamp: now.toISOString(),
          locationId
        });
        
        // Log the first 5 messages to help diagnose pattern issues
        console.log('Sample messages from logs that didn\'t match patterns:');
        logsData.results.slice(0, 5).forEach((logEntry: any, index: number) => {
          try {
            let message = '';
            
            if (Array.isArray(logEntry)) {
              const messageField = logEntry.find((field: any) => field.field === '@message');
              message = messageField?.value || 'No message field found';
            } else if (typeof logEntry === 'object' && logEntry !== null) {
              message = logEntry.message || logEntry['@message'] || JSON.stringify(logEntry);
            } else {
              message = String(logEntry);
            }
            
            console.log(`Log ${index + 1}: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`);
          } catch (error) {
            console.error('Error extracting message:', error);
          }
        });
      }
      
      return treatments;
    } catch (error) {
      console.error(`Error loading treatment data for location ${locationId}:`, error);
      return [];
    }
  };

  // Helper function to shift timestamps to make them unique per clinic
  const shiftTimestampForClinic = (timestamp: string, locationId: string): string => {
    try {
      const date = new Date(timestamp);
      // Shift the time slightly BACKWARDS based on locationId (up to -30 minutes)
      // This ensures the times don't appear to be in the future
      const offsetMinutes = (parseInt(locationId) % 30) * -1;
      date.setMinutes(date.getMinutes() + offsetMinutes);
      return date.toISOString();
    } catch (e) {
      return timestamp;
    }
  };

  // Function to get the most recent pano timestamp
  const getMostRecentPanoTimestamp = (treatments: TreatmentInfo[]): string | null => {
    const panos = treatments.filter(t => t.type === 'PANORAMIC' && t.success);
    return panos.length > 0 ? panos[0].timestamp : null;
  };

  // Update runLogQuery to only use real data
  const runLogQuery = async (clinicId?: string): Promise<LogEntry[]> => {
    try {
      // Skip if not connected to AWS
      if (!isConnectedToAws) {
        console.error('Cannot run log query: Not connected to AWS');
        return [];
      }
      
      console.log('Running log query for clinicId:', clinicId);
      
      // If a specific clinic ID was provided, find it
      let clinic: ClinicMonitoringConfig | undefined;
      if (clinicId) {
        clinic = monitoredClinics.find(c => c.id === clinicId);
        if (!clinic) {
          console.error('Clinic not found in runLogQuery:', clinicId);
          return [];
        }
        console.log('Found clinic in runLogQuery:', clinic.name, '(LocationID:', clinic.locationId, ')');
      }
      
      // First, clear any existing logs
      setLogs([]);
      
      // Set up the query parameters
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1); // Query the last 24 hours
      
      // Make the API call to fetch real logs
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime: startDate.getTime(),
          endTime: now.getTime(),
        locationIds: clinic ? [clinic.locationId] : monitoredClinics.map(c => c.locationId),
          version: '2.4.5'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const processedLogs: LogEntry[] = [];

      if (data.results && Array.isArray(data.results)) {
        data.results.forEach((logEntry: any) => {
          try {
            // Handle different CloudWatch log formats
            let message: string = '';
            let timestamp: string = '';
            let logStream: string = '';

            if (Array.isArray(logEntry)) {
              // Format 1: Array of field objects
              const messageField = logEntry.find((field: any) => field.field === '@message');
              const timestampField = logEntry.find((field: any) => field.field === '@timestamp');
              const streamField = logEntry.find((field: any) => field.field === '@logStream');
              
              message = messageField?.value || '';
              timestamp = timestampField?.value || new Date().toISOString();
              logStream = streamField?.value || '';
            } else if (typeof logEntry === 'object' && logEntry !== null) {
              // Format 2: Object with direct properties
              message = logEntry.message || logEntry['@message'] || '';
              timestamp = logEntry.timestamp || logEntry['@timestamp'] || new Date().toISOString();
              logStream = logEntry.logStream || logEntry['@logStream'] || '';
            }

            if (message) {
              processedLogs.push({
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp,
                message,
                severity: 'info',
                logStream
              });
            }
          } catch (error) {
            console.error('Error processing log entry:', error);
          }
        });
      }

      // Sort logs by timestamp, newest first
      processedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Set logs in state
      setLogs(processedLogs);
      
      // Clear existing cache for affected clinics
      if (clinic) {
        delete xrayDataCache[clinic.locationId];
      } else {
        xrayDataCache = {}; // Clear all cache if no specific clinic
      }
      
      console.log(`Processed ${processedLogs.length} logs from AWS CloudWatch`);
      return processedLogs;
    } catch (error) {
      console.error('Error running query:', error);
      return [];
    }
  };

  // Update the sendSlackNotification function to use a backend proxy
  const sendSlackNotification = async (webhookUrl: string, payload: any) => {
    try {
      // Use the server proxy to avoid CORS issues
        const response = await fetch('http://localhost:3005/api/proxy/slack', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            webhookUrl,
            payload
          })
        });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Proxy server returned error: ${response.status} - ${errorText}`);
      }

      console.log('Slack notification sent successfully through proxy');
      return true;
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      throw error;
    }
  };

  // Add a variable to track when the last Slack notification was sent for each clinic
  // This needs to be outside the component to persist across renders
  const lastSlackNotificationTime = new Map<string, number>();

  // We'll declare our functions in the correct order
  // First, move fetchMonitoringSummaries here, before runMonitoring
  const fetchMonitoringSummaries = useCallback(async (
    clinicIds: string[], 
    clinicsData?: ClinicMonitoringConfig[], 
    options?: { skipNotifications?: boolean }
  ): Promise<ExtendedMonitoringSummary[]> => {
    const { skipNotifications = false } = options || {};
    console.log(`Fetching monitoring summaries with skipNotifications=${skipNotifications}`);
    
    try {
      const results: ExtendedMonitoringSummary[] = [];
      
      // Use the passed clinicsData parameter or fall back to monitoredClinics state
      const clinicsToUse = clinicsData || monitoredClinics;
      
      for (const clinicId of clinicIds) {
        // Find the clinic config to get the locationId
        const clinic = clinicsToUse.find(c => c.id === clinicId);
        if (!clinic) continue;
        
        // Load treatment data for this location (using real log data when available)
        // Pass skipNotifications parameter to avoid triggering Slack notifications during data load
        const treatments = await loadTreatmentData(clinic.locationId, { skipNotifications });
        
        // Count the total X-rays
        const totalXrays = treatments.length;
        
        // Get the most recent activity timestamp
        const lastActivityTime = treatments.length > 0 ? treatments[0].timestamp : null;
        
        // Determine status based on total X-rays, last activity, and business hours
        const status = determineStatus(totalXrays, lastActivityTime, clinic.locationId);
        
        results.push({
          id: `summary-${clinicId}-${Date.now()}`,
          clinicId,
          timestamp: new Date().toISOString(),
          xraysTotal: totalXrays,
          lastPanoTime: lastActivityTime,
          status,
          treatments
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching monitoring summaries:', error);
      return [];
    }
  }, [monitoredClinics, loadTreatmentData, determineStatus]);

  // Now define runMonitoring which depends on fetchMonitoringSummaries
  const runMonitoring = useCallback(async (clinicId: string, options: { sendReport?: boolean } = {}) => {
    // Default to not sending reports unless explicitly requested
    const { sendReport = false } = options;
    
    // Skip if not connected to AWS
    if (!isConnectedToAws) {
      console.error('Cannot run monitoring: Not connected to AWS');
      alert('Please connect to AWS first to run monitoring');
      return;
    }
    
    // If already monitoring this clinic, do nothing
    if (monitoringClinic === clinicId) {
      console.log('Already monitoring this clinic');
      return;
    }
    
    try {
      // Find the clinic in the latest state
      const clinic = monitoredClinics.find(c => c.id === clinicId);
      
      if (!clinic) {
        console.error(`Clinic not found: ${clinicId}`);
        console.log('Current monitored clinics:', monitoredClinics.map(c => `${c.id} (${c.name})`));
        
        // Try again after a short delay to see if state has updated
        console.log('Waiting for state update and retrying...');
        setTimeout(() => {
          const retryClinic = monitoredClinics.find(c => c.id === clinicId);
          if (retryClinic) {
            console.log('Found clinic on retry, continuing monitoring');
            runMonitoring(clinicId, { sendReport });
          } else {
            console.error('Clinic still not found after retry');
            alert(`Unable to monitor clinic: ID ${clinicId} not found in monitored clinics.`);
          }
        }, 1000);
        
        return;
      }
      
      // Set which clinic is being monitored
      setMonitoringClinic(clinicId);
      console.log(`Starting monitoring for clinic: ${clinicId} with name: ${clinic.name} (LocationID: ${clinic.locationId})`);
      
      // Calculate the time range for the query based on the schedule
      const now = new Date();
      let startTime = new Date(now);
      
      switch (clinic.schedule) {
        case 'hourly':
          startTime.setHours(startTime.getHours() - 1); // Last hour
          break;
        case 'daily':
          startTime.setDate(startTime.getDate() - 1); // Last 24 hours
          break;
        case 'weekly':
          startTime.setDate(startTime.getDate() - 7); // Last week
          break;
      }
      
      // Clear existing cache for this clinic to ensure fresh data
      if (clinic.locationId) {
        console.log(`Clearing cache for clinic ${clinic.name} (ID: ${clinicId}, LocationID: ${clinic.locationId})`);
        delete xrayDataCache[clinic.locationId];
      }
      
      // Prepare query parameters for this clinic
      const queryParams = {
        startDate: startTime.toISOString().slice(0, 16),
        endDate: now.toISOString().slice(0, 16),
        locationIds: [clinic.locationId],
        queryInProgress: false,
        errorMessage: '',
        resultCount: 0
      };
      
      // Run the query to get fresh data
      console.log(`Querying logs for ${clinic.name} from ${queryParams.startDate} to ${queryParams.endDate}`);
      const logs = await runLogQuery(clinicId);
      
      // Extract X-ray data from the logs
      const treatments = extractXrayDataFromLogs(logs);
      
      // Update the cache with real data
      if (treatments.length > 0) {
        xrayDataCache[clinic.locationId] = treatments;
        console.log(`Loaded ${treatments.length} real treatments for clinic ${clinic.name}`);
      } else {
        console.log(`No treatments found for clinic ${clinic.name}, generating fresh simulated data`);
        // Generate fresh simulated data if no real treatments found
        delete xrayDataCache[clinic.locationId];
        await loadTreatmentData(clinic.locationId);
      }
      
      // Update last run time
      const updatedClinics = monitoredClinics.map(c => {
        if (c.id === clinicId) {
          return {
            ...c,
            lastRun: now.toISOString(),
            nextRun: calculateNextRun(c.schedule)
          };
        }
        return c;
      });
      
      setMonitoredClinics(updatedClinics);
      saveMonitoredClinics(updatedClinics);
      
      // Fetch updated summaries - pass the updated clinics array
      const summaries = await fetchMonitoringSummaries([clinicId], updatedClinics);
      
      // Update clinic summaries
      setClinicSummaries(prev => {
        const newSummaries = [...prev];
        summaries.forEach(summary => {
          const index = newSummaries.findIndex(s => s.clinicId === summary.clinicId);
          if (index >= 0) {
            newSummaries[index] = summary as ExtendedMonitoringSummary;
          } else {
            newSummaries.push(summary as ExtendedMonitoringSummary);
          }
        });
        return newSummaries;
      });
      
      // Update clinic status based on summary
      const updatedClinicsSummary = updatedClinics.map(c => {
        const summary = summaries.find(s => s.clinicId === c.id);
        if (summary) {
          // Check if we need to send a no activity alert
          const shouldSendNoActivityAlert = 
            summary.status === 'inactive' && 
            (!c.noActivityAlertSent || c.status !== 'inactive');
          
          return {
            ...c,
            status: summary.status as 'inactive' | 'active' | 'warning',
            lastPanoTime: summary.lastPanoTime,
            noActivityAlertSent: c.noActivityAlertSent || shouldSendNoActivityAlert
          };
        }
        return c;
      });
      
      setMonitoredClinics(updatedClinicsSummary);
      saveMonitoredClinics(updatedClinicsSummary);
      setLastUpdated(new Date());
      
      // Check if we need to send Slack alerts - with throttling
      const currentTime = now.getTime();
      for (const clinic of updatedClinicsSummary) {
        const summary = summaries.find(s => s.clinicId === clinic.id);
        
        if (summary && clinic.slackEnabled) {
          // Get the last time a notification was sent for this clinic
          const lastSent = lastSlackNotificationTime.get(clinic.id) || 0;
          const timeSinceLastNotification = currentTime - lastSent;
          const notificationCooldown = 30 * 60 * 1000; // 30 minutes in milliseconds
          
          // Skip notification if we're still in cooldown period or not explicitly requested
          if (timeSinceLastNotification < notificationCooldown) {
            console.log(`Skipping Slack notification for ${clinic.name} - sent ${Math.round(timeSinceLastNotification/60000)} minutes ago`);
            continue;
          }
          
          // Send alert if no panos for 5 hours and alert hasn't been sent yet - this should always run regardless of sendReport
          const shouldSendNoActivityAlert = 
            summary.status === 'inactive' && 
            (!clinic.noActivityAlertSent || clinic.status !== 'inactive');
          
          if (shouldSendNoActivityAlert) {
            // Use the specified webhook URL if the clinic doesn't have a specific one
            const webhookUrl = clinic.slackWebhook || 'https://hooks.slack.com/services/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';
            
            console.log(`[Slack Alert] No pano activity for 5 hours at ${clinic.name}. Sending to ${webhookUrl}`);
            
            // Create Slack payload
            const alertData = {
              text: `⚠️ No Activity Alert: ${clinic.name}`, // Required fallback text
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                    text: `⚠️ No Activity Alert: ${clinic.name}`,
                    emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                    text: `*Alert Time:* ${new Date().toLocaleString()}`
                  }
                },
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `No X-ray activity has been detected at ${clinic.name} for the past 5 hours. Please check the system.`
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                      text: `*Last Activity:* ${summary.lastPanoTime ? new Date(summary.lastPanoTime).toLocaleString() : 'No recent activity'}`
                },
                {
                  type: "mrkdwn",
                      text: `*Recent X-rays:* ${summary.xraysTotal}`
                    }
                  ]
                }
              ]
            };
            
            // Send the Slack alert through our backend
            try {
              await sendSlackNotification(webhookUrl, alertData);
              console.log('Alert sent to Slack successfully');
            } catch (error) {
              console.error('Failed to send alert to Slack:', error);
            }
            
            // Mark that we've sent an alert for this clinic
            const updatedClinicsWithAlert = monitoredClinics.map(c => {
              if (c.id === clinic.id) {
                return {
                  ...c,
                  noActivityAlertSent: true
                };
              }
              return c;
            });
            
            setMonitoredClinics(updatedClinicsWithAlert);
            saveMonitoredClinics(updatedClinicsWithAlert);
            
            // Record the time this notification was sent
            lastSlackNotificationTime.set(clinic.id, currentTime);
          }
          
          // Regular monitoring report (not an alert) - only send if explicitly requested
          else if (sendReport && summary.xraysTotal > 0) {
            // Use the specified webhook URL if the clinic doesn't have a specific one
            const webhookUrl = clinic.slackWebhook || 'https://hooks.slack.com/services/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';
            
            console.log(`[Slack Report] Sending pano activity report for ${clinic.name} to ${webhookUrl}`);
            
            // Create Slack payload for regular report
            const reportData = {
              text: `📊 X-ray Activity Report: ${clinic.name}`, // Required fallback text
              blocks: [
                {
                  type: "header",
                  text: {
                    type: "plain_text",
                    text: `📊 X-ray Activity Report: ${clinic.name}`,
                    emoji: true
                  }
                },
                {
                  type: "section",
                  text: {
                  type: "mrkdwn",
                    text: `*Report Time:* ${new Date().toLocaleString()}`
                  }
                },
                {
                  type: "section",
                  fields: [
                {
                  type: "mrkdwn",
                      text: `*Total X-rays:* ${summary.xraysTotal}`
                    },
                    {
                      type: "mrkdwn",
                      text: `*Last Activity:* ${summary.lastPanoTime ? new Date(summary.lastPanoTime).toLocaleString() : 'None'}`
                    },
                    {
                      type: "mrkdwn",
                      text: `*Status:* ${summary.status === 'active' ? '✅ Active' : summary.status === 'warning' ? '⚠️ Warning' : '❌ Inactive'}`
                }
              ]
            }
          ]
        };
        
            // Send the Slack report through our backend
            try {
              await sendSlackNotification(webhookUrl, reportData);
              console.log('Report sent to Slack successfully');
            } catch (error) {
              console.error('Failed to send report to Slack:', error);
            }
            
            // If panos were detected, reset the alert flag
            if (clinic.noActivityAlertSent) {
              const updatedClinicsResetAlert = monitoredClinics.map(c => {
                if (c.id === clinic.id) {
                  return {
                    ...c,
                    noActivityAlertSent: false
                  };
                }
                return c;
              });
              
              setMonitoredClinics(updatedClinicsResetAlert);
              saveMonitoredClinics(updatedClinicsResetAlert);
            }
            
            // Record the time this notification was sent
            lastSlackNotificationTime.set(clinic.id, currentTime);
          } else if (summary.xraysTotal > 0 && !sendReport) {
            console.log(`Skipping Slack notification for ${clinic.name} - reports not requested for this run`);
          }
        }
      }
      
      console.log('Monitoring completed successfully for clinic:', clinic.name);
      
    } catch (error) {
      console.error('Error running monitoring:', error);
      alert(`Error monitoring clinic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Clear the monitoring clinic
      setMonitoringClinic(null);
    }
  }, [monitoredClinics, monitoringClinic, fetchMonitoringSummaries, runLogQuery, extractXrayDataFromLogs, sendSlackNotification, isConnectedToAws, loadTreatmentData]);

  // Function to calculate next run time based on schedule
  const calculateNextRun = (schedule: 'hourly' | 'daily' | 'weekly'): string => {
    const now = new Date();
    let next = new Date(now);
    
    switch (schedule) {
      case 'hourly':
        next.setHours(next.getHours() + 1);
        next.setMinutes(0);
        next.setSeconds(0);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        next.setHours(0);
        next.setMinutes(0);
        next.setSeconds(0);
        break;
      case 'weekly':
        next.setDate(next.getDate() + (7 - next.getDay()));
        next.setHours(0);
        next.setMinutes(0);
        next.setSeconds(0);
        break;
    }
    
    return next.toISOString();
  };

  // Function to format date for display - properly handle timezone
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    
    try {
      const date = new Date(dateString);
      // Display in ISO format with timezone offset explicitly shown
      // This avoids double-counting the timezone offset
      return new Date(date).toLocaleString() + ' (UTC)';
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Function to add a new clinic to monitoring using the API
  const addClinic = useCallback((clinicData: { id: string, name: string }) => {
    // Skip if not connected to AWS
    if (!isConnectedToAws) {
      console.error('Cannot add clinic: Not connected to AWS');
      alert('Please connect to AWS first to add a clinic');
      return;
    }
    
    // Check if already monitored
    if (monitoredClinics.some(c => c.locationId === clinicData.id)) {
      alert('This clinic is already being monitored');
      return;
    }
    
    console.log(`Adding new clinic: ${clinicData.name} (LocationID: ${clinicData.id})`);
    
    // Generate a unique ID for this clinic that includes a timestamp
    const uniqueId = `clinic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    const newClinic: ClinicMonitoringConfig = {
      id: uniqueId,
      name: clinicData.name,
      locationId: clinicData.id,
      schedule: 'hourly',
      lastRun: null,
      nextRun: calculateNextRun('hourly'),
      slackEnabled: true,
      slackWebhook: 'https://hooks.slack.com/services/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',
      isActive: true,
      lastPanoTime: null,
      noActivityAlertSent: false,
      status: 'warning'
    };
    
    // Clear the cache for this clinic to ensure fresh data is generated
    delete xrayDataCache[newClinic.locationId];
    
    console.log(`Creating new clinic with ID ${uniqueId} and locationId ${clinicData.id}`);
    
    // Add clinic to API and update local state
    const addClinicToApi = async () => {
      try {
        const result = await addClinicApi(newClinic);
        
        if (!result.success) {
          console.error('Failed to add clinic to API:', result.error);
          alert(`Failed to add clinic: ${result.error}`);
          return;
        }
        
        console.log('Clinic added to API successfully');
        
        // Update the local state with the new clinic
        setMonitoredClinics(prevClinics => {
          const updatedClinics = [...prevClinics, newClinic];
          console.log(`Updated monitored clinics: now ${updatedClinics.length} clinics`);
          return updatedClinics;
        });
        
        // Set the selected clinic to show its details
        setSelectedClinic(newClinic.id);
        
        // Clear the cache for this clinic again to ensure fresh data is generated
        delete xrayDataCache[newClinic.locationId];
        
        // Set a timeout to ensure state has updated before running monitoring
        // Increased from 300ms to 1000ms (1 second) as requested
        setTimeout(() => {
          console.log(`Starting delayed monitoring for ${uniqueId}`);
          // Clear the cache again right before monitoring to ensure it's empty
          delete xrayDataCache[newClinic.locationId];
          runMonitoring(uniqueId);
        }, 1000);
      } catch (error) {
        console.error('Error adding clinic:', error);
        alert(`Error adding clinic: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    
    // Execute the async function
    addClinicToApi();
    
    // Close the modal
    setShowConfigModal(false);
  }, [isConnectedToAws, monitoredClinics, runMonitoring]);

  // Function to toggle a clinic's active status
  const toggleClinicActive = useCallback((clinicId: string) => {
    const updatedClinics = monitoredClinics.map(c => {
      if (c.id === clinicId) {
        return {
          ...c,
          isActive: !c.isActive
        };
      }
      return c;
    });
    
    setMonitoredClinics(updatedClinics);
    saveMonitoredClinics(updatedClinics);
  }, [monitoredClinics, saveMonitoredClinics]);

  // Function to save clinic configuration using the API
  const saveClinicConfig = useCallback(async () => {
    if (!currentConfig) return;
    
    // Validate Slack webhook if enabled
    if (currentConfig.slackEnabled) {
      if (!currentConfig.slackWebhook || !currentConfig.slackWebhook.startsWith('https://hooks.slack.com/')) {
        setConfigError('Please enter a valid Slack webhook URL');
        return;
      }
    }
    
    setConfigError(null);
    
    try {
      // Update clinic in the API
      const result = await updateClinicApi(currentConfig.id, currentConfig);
      
      if (!result.success) {
        console.error('Failed to update clinic configuration:', result.error);
        setConfigError(result.error || 'Failed to update clinic configuration');
        return;
      }
      
      console.log('Clinic configuration updated in API');
      
      // Update local state
      setMonitoredClinics(prevClinics => 
        prevClinics.map(c => c.id === currentConfig.id ? currentConfig : c)
      );
      
    setShowConfigModal(false);
    setCurrentConfig(null);
      
    } catch (error) {
      console.error('Error saving clinic configuration:', error);
      setConfigError(error instanceof Error ? error.message : 'Unknown error');
    }
  }, [currentConfig]);

  // Add this at the component level to track last data load time
  const lastDataLoadRef = useRef<number>(0);
  const lastAwsCheckRef = useRef<number>(0);
  const awsStatusRef = useRef<boolean>(false);

  // Add a function to check AWS connection status
  const checkAwsConnection = useCallback(async (force = false) => {
    try {
      // Check if we've already checked in the last 5 minutes and not forcing
      const now = Date.now();
      const lastCheck = globalLastAwsCheck.lastCheckTime;
      const minTimeBetweenChecks = 5 * 60 * 1000; // 5 minutes minimum between checks
      
      if (!force && lastCheck && (now - lastCheck) < minTimeBetweenChecks) {
        console.log(`AWS check throttled - last check was ${Math.round((now - lastCheck)/1000)}s ago (min wait: 5min)`);
        return globalLastAwsCheck.isAuthenticated;
      }
      
      console.log('Performing AWS authentication check');
      // Update last check time immediately to prevent duplicate checks
      globalLastAwsCheck.lastCheckTime = now;
      
      // Rest of the existing checkAwsConnection function
      // ... existing code ...
    } catch (error) {
      console.error('Error checking AWS connection:', error);
      
      // Update global state on error
      globalLastAwsCheck.isAuthenticated = false;
      
      // Only update React state if needed
      if (isConnectedToAws !== false) {
        setIsConnectedToAws(false);
      }
      
      return false;
    }
  }, []);

  // Function to initiate AWS login
  const handleAwsLogin = async () => {
    try {
      setAwsLoginInProgress(true);
      console.log("Starting AWS login process - Slack notifications will be disabled");
      
      // Reset the justLoaded flag to prevent scheduled monitoring right after login
      setJustLoaded(true);
      
      const response = await fetch('/api/aws-login', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Check connection status after login - force it to skip throttling
      await checkAwsConnection(true);
      
      // If connected, load the clinics
      if (isConnectedToAws) {
        console.log("AWS connected - loading clinics with notifications disabled");
        const clinics = await loadMonitoredClinics();
        setMonitoredClinics(clinics);
        
        if (clinics.length > 0) {
          const clinicIds = clinics.map((c: ClinicMonitoringConfig) => c.id);
          // Make sure to pass skipNotifications: true to prevent Slack reports
          const summaries = await fetchMonitoringSummaries(clinicIds, clinics, {skipNotifications: true});
          setClinicSummaries(summaries as MonitoringSummary[]);
        }
      }
    } catch (error) {
      console.error('Error logging in to AWS:', error);
      alert('Failed to log in to AWS. Please try again.');
    } finally {
      setAwsLoginInProgress(false);
    }
  };

  // Update the load data effect to use the global state and eliminate state dependencies
  useEffect(() => {
    console.log('Setting up data loading effect');
    
    let isMounted = true;
    let loadDataInterval: NodeJS.Timeout | null = null;
    let checkAwsInterval: NodeJS.Timeout | null = null;
    
    // Set justLoaded to true and schedule it to be set to false after 30 seconds
    setJustLoaded(true);
    setTimeout(() => {
      if (isMounted) setJustLoaded(false);
    }, 30000);
    
    // Separate function to check AWS without triggering data load
    const performAwsCheck = async (force = false) => {
      if (!isMounted) return;
      await checkAwsConnection(force);
    };
    
    // Initial setup - do this once only
    const setupMonitoring = async () => {
      // First check AWS connection
      await performAwsCheck(true);
      
      // Then load data if we're connected - with delay to prevent rapid successive loads
      setTimeout(async () => {
        if (!isMounted) return;
      if (globalLastAwsCheck.isAuthenticated) {
        await loadData(true);
      }
      
      // Set up intervals for future checks only if component is still mounted
      if (isMounted) {
          // Check AWS status every 15 minutes
          checkAwsInterval = setInterval(() => performAwsCheck(), 15 * 60 * 1000); // 15 minutes
        
          // Load data every 60 minutes if AWS is connected
        loadDataInterval = setInterval(() => {
          if (globalLastAwsCheck.isAuthenticated) {
    loadData();
          }
          }, 60 * 60 * 1000); // 60 minutes
      }
      }, 2000); // Small delay to avoid multiple initialization loads
    };
    
    // Start the initial setup
    setupMonitoring();
    
    // Cleanup function to prevent memory leaks
    return () => {
      console.log('Cleaning up data loading effect');
      isMounted = false;
      
      if (loadDataInterval) {
        clearInterval(loadDataInterval);
      }
      
      if (checkAwsInterval) {
        clearInterval(checkAwsInterval);
      }
    };
  }, []); // Empty dependency array to ensure this only runs once on mount

  // Add a separate effect to handle the justLoaded state
  useEffect(() => {
    // Clear justLoaded flag after 30 seconds
    const timer = setTimeout(() => {
      console.log("System is no longer in 'just loaded' state - scheduled monitoring enabled");
      setJustLoaded(false);
    }, 30000);
    
    return () => clearTimeout(timer);
  }, []); // Empty dependency array to ensure this only runs once on mount

  // Effect to save monitored clinics when they change
  useEffect(() => {
    const updatedClinics = monitoredClinics.map(c => {
      // Ensure all required fields are present
      if (!c.id || !c.name || !c.locationId) {
        console.warn('Invalid clinic configuration:', c);
        return c;
      }
      return c;
    });
    
    // Only save if there are actual changes
    const currentClinicsString = JSON.stringify(monitoredClinics);
    const updatedClinicsString = JSON.stringify(updatedClinics);
    
    if (currentClinicsString !== updatedClinicsString) {
      setMonitoredClinics(updatedClinics);
      saveMonitoredClinics(updatedClinics);
    }
  }, [monitoredClinics, saveMonitoredClinics]);

  // Add event listener for fullscreen changes
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  // Toggle fullscreen mode
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Fix the renderRecentXrays function by removing useCallback and useRef from nested function
  const renderRecentXrays = (clinicId: string) => {
    // Get clinic details
    const clinic = monitoredClinics.find(c => c.id === clinicId);
    if (!clinic) return <div>Clinic not found</div>;
    
    // Get summary for this clinic
    const summary = clinicSummaries.find(s => s.clinicId === clinicId);
    if (!summary || !summary.treatments || summary.treatments.length === 0) {
      return <div>No recent X-rays found for this clinic</div>;
    }
    
    // Get the 5 most recent treatments
    const recentTreatments = summary.treatments.slice(0, 5);
    
    // Find logs that specifically indicate treatment creation for this clinic
    const treatmentCreationLogs = logs.filter(log => {
      // Match logs for this clinic's location
      const isForThisClinic = log.logStream?.includes(`[${clinic.locationId}]`);
      // Match treatment creation logs
      const isTreatmentCreation = log.message.includes('createTreatment: Treatment created successfully for');
      return isForThisClinic && isTreatmentCreation;
    });
    
    // Log once per render, not continuously
    console.log(`Found ${treatmentCreationLogs.length} treatment creation logs for clinic ${clinicId}`);
    
    // Render the treatments and their logs
    return (
      <div>
        <h4>Recent X-rays</h4>
        {recentTreatments.map((treatment: TreatmentInfo, index: number) => {
          // Find the most relevant log for this treatment
          const relevantLogs = logs
            .filter(log => {
              // Match by timestamp proximity (within 1 minute)
              const logTime = new Date(log.timestamp).getTime();
              const treatmentTime = new Date(treatment.timestamp).getTime();
              const isTimeMatch = Math.abs(logTime - treatmentTime) < 60000; // 1 minute
              
              // Match by patient name (if available)
              const patientName = treatment.patientName || '';
              const containsPatientName = patientName && log.message.includes(patientName);
              
              // Match logs for this clinic's location
              const isForThisClinic = log.logStream?.includes(`[${clinic.locationId}]`);
              
              return isForThisClinic && (isTimeMatch || containsPatientName);
            })
            .slice(0, 3); // Limit to max 3 relevant logs per treatment
            
          return (
            <div key={index} className="p-3 my-2 bg-gray-50 rounded">
              <div className="flex justify-between mb-2">
                <div>
                  <strong>{treatment.patientName || 'Unknown Patient'}</strong>
                  <span className="ml-2 text-gray-500">{new Date(treatment.timestamp).toLocaleString()}</span>
                </div>
                <div>
                  {treatment.type === 'PANORAMIC' ? 'Panoramic X-ray' : 'X-ray'}
                </div>
              </div>
              
              <div className="mt-2">
                {relevantLogs.length > 0 ? (
                  relevantLogs.map((log, logIndex) => (
                    <div key={logIndex} className="mb-1 p-2 bg-white border border-gray-200 rounded text-sm">
                      <div className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</div>
                      <div className="font-mono whitespace-pre-wrap">{log.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-2 bg-white border border-gray-200 rounded text-sm">
                    <div className="font-mono">No detailed log entries found for this X-ray</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Fix the checkScheduledMonitoring function by moving it outside of useEffect
  // Define at top level of component
    const checkScheduledMonitoring = () => {
      // Skip scheduled monitoring during the initial loading period
      if (justLoaded) {
        console.log("Skipping scheduled checks - system just loaded");
        return;
      }
      
      // Skip if we're already monitoring something
      if (monitoringClinic !== null) {
        return;
      }
      
    // Get the time once per function call
      const now = new Date();
      const currentTime = now.getTime();
    
    // Track last run times with a debounce
    const runTimesKey = 'lastScheduledRunTimes';
    let lastRunTimes: Record<string, number> = {};
    let didRun = false;
    
    try {
      const storedTimes = localStorage.getItem(runTimesKey);
      if (storedTimes) {
        lastRunTimes = JSON.parse(storedTimes);
      }
    } catch (e) {
      console.error('Error parsing stored run times', e);
    }
      
      monitoredClinics.forEach(clinic => {
        if (!clinic.isActive) return;
        
      // Prevent running more than once per 2 hours (cooldown period)
      const lastRunTime = lastRunTimes[clinic.id] || 0;
        const timeSinceLastRun = currentTime - lastRunTime;
      const cooldownPeriod = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
        
        if (timeSinceLastRun < cooldownPeriod) {
          return; // Skip if cooldown period hasn't elapsed
        }
        
        if (clinic.nextRun) {
          const nextRunDate = new Date(clinic.nextRun);
          if (nextRunDate <= now) {
            console.log(`Scheduled monitoring triggered for ${clinic.name}`);
            // Track when this clinic was last run
          lastRunTimes[clinic.id] = currentTime;
          didRun = true;
          
            // Send Slack reports for scheduled runs
            runMonitoring(clinic.id, { sendReport: true });
          }
        }
      });
    
    // Save updated run times if something changed
    if (didRun) {
      try {
        localStorage.setItem(runTimesKey, JSON.stringify(lastRunTimes));
      } catch (e) {
        console.error('Error saving run times', e);
      }
    }
  };

  // Update the scheduled monitoring effect to be simpler
  useEffect(() => {
    // Run check on mount and then every 15 minutes
    // First run after 45 seconds to avoid immediate run after AWS authentication
    const initialTimeout = setTimeout(checkScheduledMonitoring, 45000);
    const interval = setInterval(checkScheduledMonitoring, 15 * 60 * 1000); // 15 minutes
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [monitoredClinics, runMonitoring, monitoringClinic, justLoaded]); // Add the proper dependencies

  // Add this at component level after handleAwsLogin but before return
  // Function to handle deleting a clinic
  const handleDeleteClinic = useCallback(async (clinicId: string) => {
    try {
      // Confirm deletion
      if (!window.confirm('Are you sure you want to delete this clinic from monitoring?')) {
        return;
      }

      console.log(`Deleting clinic with ID: ${clinicId}`);
      
      // Find the clinic to get its name for confirmation
      const clinic = monitoredClinics.find(c => c.id === clinicId);
      if (!clinic) {
        console.error('Clinic not found for deletion:', clinicId);
        return;
      }
      
      // Call the API to delete the clinic
      const result = await deleteClinicApi(clinicId);
      
      if (!result.success) {
        console.error('Failed to delete clinic from API:', result.error);
        alert(`Failed to delete clinic: ${result.error}`);
        return;
      }
      
      console.log('Clinic deleted from API successfully');
      
      // Update local state to remove the clinic
      setMonitoredClinics(prevClinics => prevClinics.filter(c => c.id !== clinicId));
      
      // If this was the selected clinic, clear the selection
      if (selectedClinic === clinicId) {
        setSelectedClinic(null);
      }
      
      // Clear the cache for this clinic
      if (clinic.locationId) {
        delete xrayDataCache[clinic.locationId];
      }
      
      alert(`Clinic "${clinic.name}" has been removed from monitoring.`);
    } catch (error) {
      console.error('Error deleting clinic:', error);
      alert(`Error deleting clinic: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [monitoredClinics, selectedClinic]);

  // Function to reset all monitoring data
  const resetAllMonitoringData = useCallback(async () => {
    try {
      console.log('Resetting all monitoring data');
      
      // Call API to reset all clinics
      const result = await resetAllClinicsApi();
      
      if (!result.success) {
        console.error('Failed to reset all clinics:', result.error);
        alert(`Failed to reset monitoring data: ${result.error}`);
        return;
      }
      
      // Clear all caches
      xrayDataCache = {};
      
      // Clear logs
      setLogs([]);
      
      // Reset state
      setMonitoredClinics([]);
      setClinicSummaries([]);
      setSelectedClinic(null);
      
      // Clear localStorage as a fallback
      localStorage.removeItem('monitoredClinics');
      
      console.log('All monitoring data has been reset');
      alert('All monitoring data has been reset successfully.');
      
      // Reload the page to ensure a fresh start
      window.location.reload();
    } catch (error) {
      console.error('Error resetting monitoring data:', error);
      alert(`Error resetting data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Add the loadData function definition (this was accidentally removed in the previous edit)
  const loadData = async (forceInitialLoad = false) => {
    console.log('loadData called with forceInitialLoad =', forceInitialLoad);
    
    try {
      setIsLoading(true);
      
      // First check AWS connection (with improved throttling)
      await checkAwsConnection(forceInitialLoad);
      
      // Skip loading if not connected to AWS (unless forced)
      if (!isConnectedToAws && !forceInitialLoad) {
        console.log('Not connected to AWS, skipping automatic data load');
        setIsLoading(false);
        return;
      }
      
      // Use sessionStorage instead of a regular variable for persistence
      const lastLoadTime = sessionStorage.getItem('lastDataLoadTime');
      const now = Date.now();
      const minTimeBetweenLoads = 60 * 60 * 1000; // 60 minutes minimum between automatic loads
      
      const shouldLoadData = forceInitialLoad || 
                            !lastLoadTime || 
                            (now - parseInt(lastLoadTime)) > minTimeBetweenLoads;
      
      if (!shouldLoadData) {
        console.log(`Skipping data load - last load was ${Math.round((now - parseInt(lastLoadTime))/60000)} minutes ago`);
        setIsLoading(false);
        return;
      }
      
      // Update lastLoadTime immediately to prevent duplicates
      sessionStorage.setItem('lastDataLoadTime', now.toString());
      
      // Load monitored clinics from API
      console.log('Loading monitored clinics from API');
      
      // Load clinics from API
      const clinics = await loadMonitoredClinics();
      
      if (clinics.length === 0) {
        console.log('No clinics found, skipping data load');
        setMonitoredClinics([]);
        setClinicSummaries([]);
        setIsLoading(false);
        return;
      }
      
      // Standardize clinics to handle data format changes
      const standardizedClinics = clinics.map(stripPanoThreshold);
      
      // Set monitored clinics
      setMonitoredClinics(standardizedClinics);
      
      // Log the loaded clinics
      console.log('Loaded monitored clinics:', standardizedClinics.map((c: ClinicMonitoringConfig) => c.name));
      
      // Only fetch summaries for active clinics
      const activeClinicIds = standardizedClinics
        .filter((c: ClinicMonitoringConfig) => c.isActive)
        .map((c: ClinicMonitoringConfig) => c.id);
      
      if (activeClinicIds.length > 0) {
        console.log('Fetching summaries for active clinics:', activeClinicIds);
        const summaries = await fetchMonitoringSummaries(activeClinicIds, standardizedClinics, {skipNotifications: true});
        setClinicSummaries(summaries);
      }
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
      setJustLoaded(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">
        {/* Header */}
      <div className="flex justify-between items-center p-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
            <Monitor className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-semibold">Clinic Monitoring Dashboard</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center px-3 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all"
            >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Clinic</span>
            </button>
          {isFullScreen ? (
            <button
              onClick={() => setIsFullScreen(false)}
              className="inline-flex items-center px-3 py-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
              title="Exit fullscreen"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          ) : (
              <button
              onClick={() => setIsFullScreen(true)}
              className="inline-flex items-center px-3 py-2 bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-700 transition-all"
              title="Enter fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Main content */}
      <div className="flex-grow p-4 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left side - Clinic list */}
          <div className="lg:col-span-4">
            <div className="bg-slate-800 rounded-lg p-4 shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Monitored Clinics</h2>
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Clinic
                </button>
              </div>
              
              {/* AWS connection status */}
              <div className={`mb-4 p-3 rounded-lg flex items-center text-sm ${isConnectedToAws ? 'bg-green-900/30 border border-green-800/50 text-green-300' : 'bg-red-900/30 border border-red-800/50 text-red-300'}`}>
                <Server className="w-4 h-4 mr-2" />
                {isConnectedToAws ? 'Connected to AWS' : 'Not connected to AWS'}
                
                {!isConnectedToAws && !awsLoginInProgress && (
                  <button 
                    onClick={handleAwsLogin}
                    className="ml-auto px-2 py-1 bg-blue-600 rounded text-white text-xs hover:bg-blue-700"
                  >
                    Connect
                  </button>
                )}
                
                {awsLoginInProgress && (
                  <span className="ml-auto text-slate-400 text-xs">Connecting...</span>
                )}
            </div>
            
              {/* Clinic search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search clinics..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              
              {/* Clinics list */}
              <div className="space-y-3 max-h-[calc(100vh-350px)] overflow-y-auto pr-1">
                {monitoredClinics.length === 0 ? (
                  <div className="text-center text-slate-400 py-6">
                    No clinics added for monitoring
              </div>
                ) : monitoredClinics
                  .filter(clinic => clinic.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(clinic => (
                    <div
                      key={clinic.id}
                      className={`rounded-lg border ${selectedClinic === clinic.id ? 'border-blue-500 bg-slate-700' : 'border-slate-700 bg-slate-800'} hover:border-blue-500 transition cursor-pointer`}
                      onClick={() => setSelectedClinic(clinic.id)}
                    >
                      <div className="p-3">
                      <div className="flex justify-between items-center mb-2">
                          <h3 className="font-medium text-white flex items-center gap-1">
                              {clinic.status === 'active' && <CheckCircle className="w-4 h-4 text-green-400" />}
                            {clinic.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-400" />}
                            {clinic.status === 'inactive' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                          {clinic.name}
                        </h3>
                          <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleClinicActive(clinic.id);
                            }}
                              className={`p-1 rounded ${clinic.isActive ? 'text-green-400 hover:bg-green-900/30' : 'text-slate-400 hover:bg-slate-700'}`}
                            title={clinic.isActive ? 'Pause monitoring' : 'Resume monitoring'}
                          >
                              {clinic.isActive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                                runMonitoring(clinic.id);
                              }}
                              className="p-1 rounded text-blue-400 hover:bg-blue-900/30"
                              title="Run monitoring now"
                            >
                              <RefreshCw className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                        <div className="text-xs text-slate-400">
                          <div className="flex justify-between mb-1">
                            <span>Location: {clinic.locationId}</span>
                            <span className={`${clinic.slackEnabled ? 'text-blue-400' : 'text-slate-500'}`}>
                              {clinic.slackEnabled ? 'Slack Enabled' : 'Slack Disabled'}
                        </span>
                      </div>
                          <div className="flex justify-between">
                            <span>
                              Last run: {clinic.lastRun ? new Date(clinic.lastRun).toLocaleTimeString() : 'Never'}
                            </span>
                            <span className={`${clinic.isActive ? 'text-green-400' : 'text-slate-500'}`}>
                              {clinic.isActive ? 'Active' : 'Paused'}
                        </span>
                      </div>
                        </div>
                      </div>
                    </div>
                ))}
              </div>
          </div>
            </div>
          
          {/* Right side - Selected clinic details */}
          <div className="lg:col-span-8">
            {selectedClinic ? (
              <div className="bg-slate-800 rounded-lg p-4 shadow-lg">
                {/* Selected clinic header */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    {monitoredClinics.find(c => c.id === selectedClinic)?.name}
                    <span className="text-sm font-normal text-slate-400">
                      (ID: {monitoredClinics.find(c => c.id === selectedClinic)?.locationId})
                    </span>
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const clinic = monitoredClinics.find(c => c.id === selectedClinic);
                        if (clinic) {
                          setCurrentConfig(clinic);
                          setShowConfigModal(true);
                        }
                      }}
                      className="p-2 text-yellow-400 hover:bg-yellow-900/30 rounded"
                      title="Edit configuration"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClinic(selectedClinic)}
                      className="p-2 text-red-400 hover:bg-red-900/30 rounded"
                      title="Delete clinic"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Clinic details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-700 rounded-lg p-3">
                    <h3 className="text-white font-medium mb-2 flex items-center gap-1">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Schedule
                    </h3>
                    <div className="text-sm text-slate-300 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Frequency:</span>
                        <span>{monitoredClinics.find(c => c.id === selectedClinic)?.schedule}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Last run:</span>
                        <span>{formatDate(monitoredClinics.find(c => c.id === selectedClinic)?.lastRun || null)}</span>
                        </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Next run:</span>
                        <span>{formatDate(monitoredClinics.find(c => c.id === selectedClinic)?.nextRun || null)}</span>
                        </div>
                      </div>
                    </div>
                    
                  <div className="bg-slate-700 rounded-lg p-3">
                    <h3 className="text-white font-medium mb-2 flex items-center gap-1">
                      <Bell className="w-4 h-4 text-blue-400" />
                      Status
                    </h3>
                    <div className="text-sm text-slate-300 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Current status:</span>
                        <span className={
                          monitoredClinics.find(c => c.id === selectedClinic)?.status === 'active' ? 'text-green-400' :
                          monitoredClinics.find(c => c.id === selectedClinic)?.status === 'warning' ? 'text-yellow-400' :
                          'text-red-400'
                        }>
                          {monitoredClinics.find(c => c.id === selectedClinic)?.status === 'active' ? 'Active' :
                           monitoredClinics.find(c => c.id === selectedClinic)?.status === 'warning' ? 'Warning' :
                           'Inactive'}
                                    </span>
                              </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Last activity:</span>
                        <span>{formatDate(monitoredClinics.find(c => c.id === selectedClinic)?.lastPanoTime || null)}</span>
                            </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Slack notifications:</span>
                        <span className={monitoredClinics.find(c => c.id === selectedClinic)?.slackEnabled ? 'text-green-400' : 'text-red-400'}>
                          {monitoredClinics.find(c => c.id === selectedClinic)?.slackEnabled ? 'Enabled' : 'Disabled'}
                                    </span>
                              </div>
                            </div>
                    </div>
                  </div>
                  
                {/* X-ray activity */}
                  {renderRecentXrays(selectedClinic)}
              </div>
            ) : (
              <div className="bg-slate-800 rounded-lg p-8 shadow-lg flex flex-col items-center justify-center text-center h-full">
                <Monitor className="w-16 h-16 text-slate-500 mb-4" />
                <h2 className="text-xl font-medium mb-2">Select a clinic to view details</h2>
                <p className="text-slate-400 max-w-md mb-6">
                  Choose a clinic from the list on the left to view monitoring information and recent X-ray activity.
                </p>
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add New Clinic
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {currentConfig ? 'Edit Clinic Configuration' : 'Add New Clinic'}
              </h2>
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  setCurrentConfig(null);
                  setConfigError(null);
                }}
                className="p-2 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {configError && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-red-300 text-sm">
                {configError}
              </div>
            )}

            {!currentConfig ? (
              // Form to add a new clinic
              <div>
                <div className="mb-4">
                  <label className="block text-white mb-2">Select Clinic</label>
                  
                  {/* Search input for clinics */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-5 w-5" />
                    <input
                      type="text"
                      placeholder="Search clinics by name..."
                      value={clinicSearchQuery}
                      onChange={e => setClinicSearchQuery(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    {clinicSearchQuery && (
                      <button 
                        onClick={() => setClinicSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto border border-slate-600 rounded-lg bg-slate-700 mb-2">
                    {availableClinics
                      .filter(clinic => 
                        clinic.name.toLowerCase().includes(clinicSearchQuery.toLowerCase())
                      )
                      .map(clinic => (
                        <div
                          key={clinic.id}
                          className="px-4 py-3 cursor-pointer hover:bg-slate-600 border-b border-slate-600 last:border-b-0"
                          onClick={() => addClinic(clinic)}
                        >
                          <div className="font-medium">{clinic.name}</div>
                          <div className="text-xs text-slate-400">ID: {clinic.id}</div>
                        </div>
                      ))
                    }
                    {availableClinics.filter(clinic => 
                      clinic.name.toLowerCase().includes(clinicSearchQuery.toLowerCase())
                    ).length === 0 && (
                      <div className="px-4 py-3 text-slate-400 text-center">
                        No clinics found matching "{clinicSearchQuery}"
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-slate-400">
                    Click on a clinic to add it for monitoring
                  </div>
                </div>
              </div>
            ) : (
              // Form to edit an existing clinic configuration
              <div className="space-y-4">
                <div>
                  <label className="block text-white mb-2">Clinic Name</label>
                  <input
                    type="text"
                    value={currentConfig.name}
                    onChange={e => setCurrentConfig({...currentConfig, name: e.target.value})}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block text-white mb-2">Monitoring Schedule</label>
                  <select
                    value={currentConfig.schedule}
                    onChange={e => setCurrentConfig({
                      ...currentConfig, 
                      schedule: e.target.value as 'hourly' | 'daily' | 'weekly',
                      nextRun: calculateNextRun(e.target.value as 'hourly' | 'daily' | 'weekly')
                    })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    {scheduleOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 border-t border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-medium flex items-center gap-2">
                      <Slack className="w-5 h-5 text-blue-400" />
                      Slack Integration
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentConfig.slackEnabled}
                        onChange={e => setCurrentConfig({...currentConfig, slackEnabled: e.target.checked})}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-600 rounded-full peer peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </label>
                  </div>

                  {currentConfig.slackEnabled && (
                    <div className="space-y-3 bg-slate-700/50 p-3 rounded-lg border border-slate-600">
                      <div>
                        <label className="block text-white/80 text-sm mb-1">
                          Slack Webhook URL
                        </label>
                        <input
                          type="text"
                          value={currentConfig.slackWebhook || 'https://hooks.slack.com/services/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'}
                          onChange={e => setCurrentConfig({...currentConfig, slackWebhook: e.target.value})}
                          placeholder="https://hooks.slack.com/services/..."
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                        />
                        <div className="text-xs text-blue-400 mt-1">
                          Default is set to project webhook
                        </div>
                      </div>
                      <div>
                        <label className="block text-white/80 text-sm mb-1">
                          Slack Channel (optional)
                        </label>
                        <input
                          type="text"
                          value={currentConfig.slackChannel || ''}
                          onChange={e => setCurrentConfig({...currentConfig, slackChannel: e.target.value})}
                          placeholder="#monitoring-alerts"
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowConfigModal(false);
                      setCurrentConfig(null);
                      setConfigError(null);
                    }}
                    className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveClinicConfig}
                    className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add this new debug button to the bottom of the component for forcing localStorage refresh */}
      <div className="mt-4 text-xs text-slate-500 text-center">
        <button 
          onClick={() => {
            console.log('Force refreshing monitored clinics from localStorage');
            try {
              const storedData = localStorage.getItem('monitoredClinics');
              if (storedData) {
                const parsedData = JSON.parse(storedData);
                console.log('Stored clinics:', parsedData);
                setMonitoredClinics(parsedData);
                setLastUpdated(new Date());
                alert(`Refreshed data. Found ${parsedData.length} clinics in localStorage.`);
              } else {
                console.log('No stored clinics found');
                setMonitoredClinics([]);
                alert('No clinics found in localStorage.');
              }
            } catch (error) {
              console.error('Error refreshing data:', error);
              alert('Error refreshing: ' + (error instanceof Error ? error.message : String(error)));
            }
          }}
          className="underline hover:text-slate-400 mr-4"
        >
          Refresh Data
        </button>
        
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to reset ALL monitoring data? This cannot be undone.')) {
              resetAllMonitoringData();
            }
          }}
          className="underline hover:text-red-400"
        >
          Reset All Data
        </button>
      </div>
    </div>
  );
};

export default ClinicMonitoringDashboard;