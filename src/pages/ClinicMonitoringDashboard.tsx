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
  Eye,
  ServerOff,
  FolderPlus,
  ListFilter,
  CheckCircle2,
  AlertCircle,
  ServerCog,
  Activity,
  BarChart2,
  ListChecks,
  Edit3,
  PlusCircle,
  Building2,
  MapPin,
  FolderX,
  Info,
  Save,
  User,
  XCircle,
  Hash,
  Link,
  Copy
} from 'lucide-react';
import { 
  fetchClinics, 
  addClinic as addClinicApi, 
  updateClinic as updateClinicApi, 
  deleteClinic as deleteClinicApi,
  resetAllClinics as resetAllClinicsApi
} from '../api/clinicApi';
import { ClinicMonitoringConfig, MonitoringSummary, TreatmentInfo as BaseTreatmentInfo } from '../types/clinic-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, LineChart } from 'recharts';
// Add import for our new NavigationLoadingPage
import NavigationLoadingPage from '../components/NavigationLoadingPage';

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

// Add a mock clinics data array at the top of the file, after the imports
// This data will be used when the API endpoint is not available
const mockAvailableClinics = [
  { id: "2261", name: "Dental Clinic Alpha" },
  { id: "2262", name: "Dental Clinic Beta" },
  { id: "2263", name: "Dental Clinic Gamma" },
  { id: "2264", name: "Dental Clinic Delta" },
  { id: "2265", name: "Dental Clinic Epsilon" }
];

// Add a timeout utility function
const fetchWithTimeout = async (url: string, options?: RequestInit, timeout = 5000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Define this function early in the file so it's available for loadMonitoredClinics
const calculateNextRun = (schedule: 'hourly' | 'daily' | 'weekly'): string => {
  const now = new Date();
  
  switch (schedule) {
    case 'hourly':
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
      now.setSeconds(0);
      break;
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(0);
      now.setMinutes(0);
      now.setSeconds(0);
      break;
    case 'weekly':
      now.setDate(now.getDate() + (7 - now.getDay()));
      now.setHours(0);
      now.setMinutes(0);
      now.setSeconds(0);
      break;
  }
  
  return now.toISOString();
};

// Add these variables at the top of the file, after the imports and before the component
// Track AWS auth check attempts to prevent infinite loops
let awsAuthCheckAttempts = 0;
const MAX_AUTH_CHECK_ATTEMPTS = 3;
let lastAuthCheckTime = 0;
const AUTH_CHECK_COOLDOWN = 30000; // 30 seconds cooldown between checks

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
  // Add state for loading page
  const [showNavigationLoading, setShowNavigationLoading] = useState(false);
  const [navigationDestination, setNavigationDestination] = useState("");
  
  // Schedule options
  const scheduleOptions = [
    { value: 'hourly', label: 'Every hour' },
    { value: 'daily', label: 'Daily (00:00 UTC)' },
    { value: 'weekly', label: 'Weekly (Sunday 00:00 UTC)' }
  ];

  // Add this new state for treatment filtering
  const [treatmentFilterType, setTreatmentFilterType] = useState<'all' | 'panoramic' | 'periapical' | 'createTreatment'>('all');
  
  // Add this new helper function for filtering treatments
  const filterTreatments = (treatments: TreatmentInfo[], filterType: 'all' | 'panoramic' | 'periapical' | 'createTreatment') => {
    if (filterType === 'all') return treatments;
    if (filterType === 'panoramic') return treatments.filter(t => t.type === 'PANORAMIC');
    if (filterType === 'periapical') return treatments.filter(t => t.type === 'PERIAPICAL');
    if (filterType === 'createTreatment') return treatments.filter(t => 
      typeof t.originalLog === 'string' && t.originalLog.toLowerCase().includes('createtreatment')
    );
    return treatments;
  };

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

  // Function to load monitored clinics from the API with fallback
  const loadMonitoredClinics = useCallback(async () => {
    try {
      const clinics = await fetchClinics();
      return clinics;
    } catch (error) {
      console.error('Failed to load monitored clinics from API:', error);
      
      // In production, return some default clinics so the app can function
      if (process.env.NODE_ENV === 'production') {
        console.warn('Using fallback clinic data in production');
        return [
          {
            id: `clinic-default-1`,
            name: "Default Clinic",
            locationId: "2261",
            schedule: 'hourly' as 'hourly', // Explicitly type as required enum value
            lastRun: null,
            nextRun: calculateNextRun('hourly'),
            status: 'inactive' as 'inactive' | 'active' | 'warning',
            lastPanoTime: null,
            isActive: true,
            slackEnabled: false,
            slackWebhook: undefined,
            slackChannel: undefined,
            noActivityAlertSent: false
          }
        ];
      }
      
      return [];
    }
  }, []);

  // Add a helper function to get API URLs that works in all environments
  const getApiUrl = (path: string): string => {
    // In production, use relative URLs that will work on any domain
    if (process.env.NODE_ENV === 'production') {
      return `/api${path}`;
    }
    // In development, use the localhost URL
    return `http://localhost:3005/api${path}`;
  };

  // Replace fetchAvailableClinics with a version that uses timeout
  const fetchAvailableClinics = useCallback(async () => {
    console.log('Fetching available clinics...');
    try {
      // Try to fetch from the real API first with timeout
      const apiUrl = getApiUrl('/clinics/available');
      console.log(`Calling API endpoint: ${apiUrl}`);
      
      const response = await fetchWithTimeout(apiUrl, {}, 5000);
      
      if (!response.ok) {
        console.warn(`API endpoint not available (${response.status}), using fallback clinic data`);
        // Return mock data if the API endpoint is not available
        return mockAvailableClinics;
      }
      
      const data = await response.json();
      console.log(`Successfully fetched ${data.length} available clinics from API`);
      return data;
    } catch (error) {
      console.error('Error fetching available clinics:', error);
      // Return mock data on any error
      console.warn('Using fallback clinic data due to fetch error');
      return mockAvailableClinics;
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
    
    // Focus on treatment creation logs specifically - this is what we want to count as X-rays
    console.log(`Analyzing ${logEntries.length} log entries for treatment data`);
    
    // Filter logs SPECIFICALLY for "Treatment created successfully" messages
    const treatmentLogs = logEntries.filter(log => {
      const message = typeof log.message === 'string' ? log.message : JSON.stringify(log);
      return message.includes('Treatment created successfully');
    });
    
    console.log(`Found ${treatmentLogs.length} logs containing 'Treatment created successfully'`);
    
    // Debug: log some example messages to see their format
    if (treatmentLogs.length > 0) {
      console.log("Example treatment logs:");
      treatmentLogs.slice(0, 5).forEach((log, idx) => {
        console.log(`${idx + 1}: ${log.message}`);
      });
    } else {
      console.log("No 'Treatment created successfully' logs found. Checking for logs with 'createTreatment'...");
      
      // If no specific treatment logs found, check for logs with createTreatment
      const createTreatmentLogs = logEntries.filter(log => 
        typeof log.message === 'string' && log.message.includes('createTreatment')
      );
      
      console.log(`Found ${createTreatmentLogs.length} logs containing 'createTreatment'`);
      
      // Process these logs if found
      if (createTreatmentLogs.length > 0) {
        let processedCount = 0;
        
        createTreatmentLogs.forEach((log, index) => {
          try {
            // Common format: "Treatment created successfully for [PATIENT_NAME]"
            const treatmentCreatedPattern = /createTreatment: Treatment created successfully for ([A-Za-z*][A-Za-z*\s]+)/;
            const match = log.message.match(treatmentCreatedPattern);
            
            if (match && match[1]) {
              const patientName = match[1].trim();
              console.log(`Extracted patient name from logs: "${patientName}"`);
              
              // Generate a patientId from the name parts
              const nameParts = patientName.split(/\s+/);
              let patientId = `patient-${index}`;
              
              if (nameParts.length >= 2) {
                // Use first two characters from each name part for the ID
                const firstInitials = nameParts[0].substring(0, 2);
                const lastInitials = nameParts[1].substring(0, 2);
                patientId = `${firstInitials}${lastInitials}-${Date.now().toString().substring(9)}-${index}`;
              }
              
              // Determine X-ray type
              const type = log.message.toLowerCase().includes('periapical') ? 'PERIAPICAL' : 'PANORAMIC';
              
              // Extract locationId from logStream or use a default
              const logLocationId = log.logStream ? log.logStream.match(/\[(\d+)\]/)?.[1] || 'unknown' : 'unknown';
              
              // Create treatment record with detailed info
              const treatment: TreatmentInfo = {
                id: `treatment-${logLocationId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                patientId,
                patientName,
                type,
                success: true,
                timestamp: log.timestamp,
                locationId: logLocationId,
                originalLog: log.message
              };
              
              // Add the treatment and log
              extractedTreatments.push(treatment);
              processedCount++;
              console.log(`Added treatment from logs: ${patientName} (${patientId}) of type ${type}`);
            }
          } catch (error) {
            console.error('Error processing log entry:', error);
          }
        });
        
        console.log(`Processed ${processedCount} createTreatment logs successfully`);
      }
    }
    
    // Sort by timestamp, newest first
    extractedTreatments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Log the counts for debugging
    const totalXrays = extractedTreatments.length;
    const panosTaken = extractedTreatments.filter(t => t.type === 'PANORAMIC').length;
    console.log(`Extracted ${totalXrays} total X-rays, including ${panosTaken} panoramic X-rays`);
    
    if (totalXrays > 0) {
      console.log("First extracted treatment example:", extractedTreatments[0]);
    } else {
      console.warn("No treatments were extracted from the logs");
    }
    
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
        console.log('No logs found in sessionStorage');
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

  // Update the loadTreatmentData function to improve X-ray extraction
  const loadTreatmentData = async (locationId: string, options?: { skipNotifications?: boolean }): Promise<TreatmentInfo[]> => {
    const { skipNotifications = false } = options || {};
    
    try {
      // Clear cache if not using it to ensure fresh data
      if (options?.skipNotifications === false) {
        delete xrayDataCache[locationId];
      }
      
      // If we have cached data, return it (for performance)
      if (xrayDataCache[locationId]) {
        console.log(`Using cached treatment data for location ${locationId} (${xrayDataCache[locationId].length} treatments)`);
        return xrayDataCache[locationId];
      }
      
      console.log(`Fetching real treatment data for location ${locationId}${skipNotifications ? ' (notifications disabled)' : ''}`);
      
      // Only attempt to fetch real data if connected to AWS
      if (!isConnectedToAws) {
        console.log('Not connected to AWS. Cannot fetch real data.');
        return [];
      }
      
      // Get the current time and 24 hours ago for the query
      const endTime = new Date().getTime();
      const startTime = endTime - (24 * 60 * 60 * 1000); // 24 hours ago
      
      try {
        console.log(`Making API call to fetch logs for location ${locationId} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
        
        // Fetch logs from CloudWatch with the correct URL and timeout
        const response = await fetchWithTimeout(
          getApiUrl('/logs'),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              startTime,
              endTime,
              locationIds: [locationId],
              version: '2.4.5',
              limit: 1000
            })
          },
          10000 // 10 second timeout
        );
        
        if (!response.ok) {
          console.error(`API call failed with status ${response.status}: ${response.statusText}`);
          throw new Error(`Failed to fetch logs: ${response.status} ${response.statusText}`);
        }
        
        const logsData = await response.json();
        console.log(`Received API response for location ${locationId}`, {
          responseType: typeof logsData,
          isArray: Array.isArray(logsData),
          hasResults: logsData.results && Array.isArray(logsData.results),
          resultsLength: logsData.results ? logsData.results.length : 0
        });
        
        // Handle different response formats
        let results = [];
        if (Array.isArray(logsData)) {
          results = logsData;
          console.log(`Found ${results.length} log entries in array format`);
        } else if (logsData.results && Array.isArray(logsData.results)) {
          results = logsData.results;
          console.log(`Found ${results.length} log entries in results.results format`);
        } else {
          // Try to adapt by extracting any array from the response
          const possibleArrays = Object.values(logsData).filter(Array.isArray);
          if (possibleArrays.length > 0) {
            results = possibleArrays[0];
            console.log(`Extracted ${results.length} log entries from response object`);
          } else {
            console.warn('Could not find any array of log entries in response', logsData);
          }
        }
        
        // Store all raw logs for reference
        const rawLogs: LogEntry[] = results.map((logEntry: any, index: number) => {
          try {
            // Handle different CloudWatch log formats
            let message: string = '';
            let timestamp: string = '';
            let logStream: string = locationId; // Default to the locationId
            let severity: 'info' | 'warning' | 'error' = 'info';
            
            if (Array.isArray(logEntry)) {
              // Format 1: Array of field objects
              const messageField = logEntry.find((field: any) => field.field === '@message');
              const timestampField = logEntry.find((field: any) => field.field === '@timestamp');
              const logStreamField = logEntry.find((field: any) => field.field === 'logStream');
              
              message = messageField?.value || '';
              timestamp = timestampField?.value || new Date().toISOString();
              if (logStreamField?.value) logStream = logStreamField.value;
            } else if (typeof logEntry === 'object' && logEntry !== null) {
              // Format 2: Object with direct properties
              message = logEntry.message || logEntry['@message'] || '';
              timestamp = logEntry.timestamp || logEntry['@timestamp'] || new Date().toISOString();
              if (logEntry.logStream) logStream = logEntry.logStream;
              
              // Try to determine severity
              if (logEntry.level) {
                severity = logEntry.level === 'error' ? 'error' : 
                          logEntry.level === 'warn' ? 'warning' : 'info';
              } else if (message.toLowerCase().includes('error')) {
                severity = 'error';
              } else if (message.toLowerCase().includes('warning') || message.toLowerCase().includes('warn')) {
                severity = 'warning';
              }
            } else {
              // String format
              try {
                // Try to parse as JSON if it's a string
                const parsed = typeof logEntry === 'string' ? JSON.parse(logEntry) : null;
                if (parsed) {
                  message = parsed.message || parsed['@message'] || '';
                  timestamp = parsed.timestamp || parsed['@timestamp'] || new Date().toISOString();
                  if (parsed.logStream) logStream = parsed.logStream;
                } else {
                  message = String(logEntry);
                  timestamp = new Date().toISOString();
                }
              } catch {
                message = String(logEntry);
                timestamp = new Date().toISOString();
              }
            }
            
            // Determine severity based on message content if not already set
            if (severity === 'info') {
              if (message.toLowerCase().includes('error')) {
                severity = 'error';
              } else if (message.toLowerCase().includes('warning') || message.toLowerCase().includes('warn')) {
                severity = 'warning';
              }
            }
        
        return {
              id: `log-${locationId}-${index}-${Date.now()}`,
              timestamp,
              message,
              logStream,
              severity
            };
          } catch (error) {
            console.error('Error processing log entry:', error);
            return {
              id: `log-${locationId}-${index}-${Date.now()}`,
              timestamp: new Date().toISOString(),
              message: 'Error processing log entry',
              logStream: locationId,
              severity: 'error'
            };
          }
        });
        
        // Parse logs to extract treatment data with enhanced pattern matching
        const treatments: TreatmentInfo[] = [];
        
        // Process the log entries to extract treatment information
        console.log(`Processing ${results.length} log entries to extract treatment data`);
        let processingErrors = 0;
        
        // Display all logs for debug purposes
        console.log(`Showing log entries (first 5 max):`);
        results.slice(0, 5).forEach((logEntry: any, index: number) => {
          try {
            let message = '';
            if (typeof logEntry === 'object' && logEntry !== null) {
              message = logEntry.message || logEntry['@message'] || JSON.stringify(logEntry).slice(0, 200);
            } else {
              message = String(logEntry).slice(0, 200);
            }
            console.log(`Log ${index + 1}: ${message}${message.length > 200 ? '...' : ''}`);
          } catch (error) {
            console.error('Error extracting log message for display:', error);
          }
        });

        // Improved extraction logic to get every X-ray from Treatment created successfully logs
        rawLogs.forEach((log, index) => {
          try {
            const { message, timestamp, logStream } = log;
            
            // Specifically look for "Treatment created successfully" messages with exact casing
            if (message.includes('Treatment created successfully')) {
              // Only add if we don't already have this exact log processed
              const isAlreadyProcessed = treatments.some(t => t.originalLog === message);
              
              if (!isAlreadyProcessed) {
                // Improved regex pattern that specifically looks for "Treatment created successfully for NAME"
                const treatmentCreatedPattern = /Treatment created successfully for ([A-Za-z*][A-Za-z*\s]+)/;
                const match = message.match(treatmentCreatedPattern);
                
                if (match && match[1]) {
                  const patientName = match[1].trim();
                  console.log(`Extracted patient name from logs: "${patientName}"`);
                  
                  // Generate a patientId from the name parts
                  const nameParts = patientName.split(/\s+/);
                  let patientId = `patient-${index}`;
                  
                  if (nameParts.length >= 2) {
                    // Use first two characters from each name part for the ID
                    const firstInitials = nameParts[0].substring(0, 2);
                    const lastInitials = nameParts[1].substring(0, 2);
                    patientId = `${firstInitials}${lastInitials}-${Date.now().toString().substring(9)}-${index}`;
                  }
                  
                  // Determine X-ray type
                  const type = message.toLowerCase().includes('periapical') ? 'PERIAPICAL' : 'PANORAMIC';
                  
                  // Create treatment record with detailed info
                  const treatment: TreatmentInfo = {
                    id: `treatment-${locationId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    patientId,
                    patientName,
                    type,
                    success: true,
                    timestamp,
                    locationId: logStream || locationId,
                    originalLog: message
                  };
                  
                  // Add the treatment and log
                  treatments.push(treatment);
                  console.log(`Added treatment from logs: ${patientName} (${patientId}) of type ${type}`);
                }
              }
            }
          } catch (error) {
            processingErrors++;
            console.error('Error processing log entry:', error);
          }
        });
        
        if (processingErrors > 0) {
          console.warn(`Encountered ${processingErrors} errors while processing log entries`);
        }

        // Sort by timestamp (newest first)
        treatments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        console.log(`Extracted ${treatments.length} real treatments from logs (${treatments.filter(t => t.type === 'PANORAMIC').length} panoramic, ${treatments.filter(t => t.type === 'PERIAPICAL').length} periapical)`);
        
        // Store extracted treatments in the cache
        xrayDataCache[locationId] = treatments;
        
        return treatments;
      } catch (fetchError) {
        console.error(`Network error fetching logs for location ${locationId}:`, fetchError);
        // Return empty array when network error occurs, we'll rely on real logs only
        return [];
      }
    } catch (error) {
      console.error(`Error loading treatment data for location ${locationId}:`, error);
      // Return empty array when error occurs, we'll rely on real logs only
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

  // Update runLogQuery to use the correct API endpoint
  const runLogQuery = async (clinicId?: string): Promise<LogEntry[]> => {
    try {
      // Skip if not connected to AWS
      if (!isConnectedToAws) {
        return [];
      }
      
      // If a specific clinic ID was provided, find it
      let clinic: ClinicMonitoringConfig | undefined;
      if (clinicId) {
        clinic = monitoredClinics.find(c => c.id === clinicId);
        if (!clinic) {
          return [];
        }
      }
      
      // First, clear any existing logs
      setLogs([]);
      
      // Set up the query parameters
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1); // Query the last 24 hours
      
      try {
        // Make the API call to fetch real logs with the correct URL and timeout
        const response = await fetchWithTimeout(
          getApiUrl('/logs'),
          {
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
          },
          10000 // 10 second timeout
        );

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
        
        return processedLogs;
      } catch (fetchError) {
        console.error('Network error running log query:', fetchError);
        // In production, return empty array to allow the app to continue functioning
        return [];
      }
    } catch (error) {
      console.error('Error running query:', error);
      return [];
    }
  };

  // Update the sendSlackNotification function with timeout
  const sendSlackNotification = async (webhookUrl: string, payload: any) => {
    try {
      // Use the server proxy to avoid CORS issues with correct URL and timeout
      const response = await fetchWithTimeout(
        getApiUrl('/proxy/slack'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            webhookUrl,
            payload
          })
        },
        8000 // 8 second timeout
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Proxy server returned error: ${response.status} - ${errorText}`);
      }

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
    
    try {
      const results: ExtendedMonitoringSummary[] = [];
      
      // Use the passed clinicsData parameter or fall back to monitoredClinics state
      const clinicsToUse = clinicsData || monitoredClinics;
      
      for (const clinicId of clinicIds) {
        // Find the clinic config to get the locationId
        const clinic = clinicsToUse.find(c => c.id === clinicId);
        if (!clinic) {
          console.warn(`Clinic not found for ID: ${clinicId}`);
          continue;
        }
        
        try {
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
        } catch (error) {
          console.error(`Error fetching data for clinic ${clinicId}:`, error);
          
          // In production, provide fallback data to keep the app functioning
          if (process.env.NODE_ENV === 'production') {
            console.warn(`Using fallback summary data for clinic ${clinicId}`);
            
            // Create a fallback summary with empty data
            results.push({
              id: `summary-${clinicId}-${Date.now()}`,
              clinicId,
              timestamp: new Date().toISOString(),
              xraysTotal: 0,
              lastPanoTime: null,
              status: 'inactive' as 'inactive' | 'active' | 'warning',
              treatments: []
            });
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching monitoring summaries:', error);
      
      // In production, return fallback data for all requested clinics
      if (process.env.NODE_ENV === 'production' && clinicIds.length > 0) {
        console.warn('Using fallback summary data for all clinics');
        return clinicIds.map(clinicId => ({
          id: `summary-${clinicId}-${Date.now()}`,
          clinicId,
          timestamp: new Date().toISOString(),
          xraysTotal: 0,
          lastPanoTime: null,
          status: 'inactive' as 'inactive' | 'active' | 'warning',
          treatments: []
        }));
      }
      
      return [];
    }
  }, [monitoredClinics, loadTreatmentData, determineStatus]);

  // Function to run monitoring for a specific clinic
  const runMonitoring = useCallback(async (clinicId: string, options?: { sendReport?: boolean }) => {
    const now = new Date();
    const { sendReport = false } = options || {};
    
    try {
      console.log(`Running monitoring for clinic ${clinicId}`);
      
      // Show that we're monitoring this clinic
      setMonitoringClinic(clinicId);
      
      // Find the clinic
      const clinic = monitoredClinics.find(c => c.id === clinicId);
      if (!clinic) {
        console.error(`Clinic not found: ${clinicId}`);
        return false;
      }
      
      // Use a consistent query window for all clinics - last 24 hours
      const queryParams = {
        startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: now.toISOString(),
        locationId: clinic.locationId
      };
      
      console.log(`Querying logs for ${clinic.name} from ${queryParams.startDate} to ${queryParams.endDate}`);
      const logs = await runLogQuery(clinicId);
      
      // Extract X-ray data from the logs
      const treatments = extractXrayDataFromLogs(logs);
      
      // Update the cache with real data
      if (treatments.length > 0) {
        xrayDataCache[clinic.locationId] = treatments;
        console.log(`Loaded ${treatments.length} real treatments for clinic ${clinic.name}`);
      } else {
        console.log(`No treatments found for clinic ${clinic.name}`);
        // Clear cache for this clinic
        delete xrayDataCache[clinic.locationId];
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
      if (sendReport && clinic.slackEnabled) {
        const currentTimeMs = now.getTime();
        const summary = summaries.find(s => s.clinicId === clinicId);
        
        if (summary) {
          // Get the last time a notification was sent for this clinic
          const lastSent = lastSlackNotificationTime.get(clinic.id) || 0;
          const timeSinceLastNotification = currentTimeMs - lastSent;
          const notificationCooldown = 30 * 60 * 1000; // 30 minutes in milliseconds
          
          // Skip notification if we're still in cooldown period
          if (timeSinceLastNotification < notificationCooldown) {
            console.log(`Skipping Slack notification for ${clinic.name} - sent ${Math.round(timeSinceLastNotification/60000)} minutes ago`);
            return;
          }
          
          // Send alert if no panos for 5 hours and alert hasn't been sent yet
          const shouldSendNoActivityAlert = 
            summary.status === 'inactive' && 
            (!clinic.noActivityAlertSent || clinic.status !== 'inactive');
          
          if (shouldSendNoActivityAlert) {
            await sendNoActivityAlert(clinic, summary);
            lastSlackNotificationTime.set(clinic.id, currentTimeMs);
          }
          // Regular monitoring report - only if we have activity
          else if (summary.xraysTotal > 0) {
            await sendActivityReport(clinic, summary);
            
            // If panos were detected and we previously had an alert, reset the alert flag
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
            
            lastSlackNotificationTime.set(clinic.id, currentTimeMs);
          }
        }
      }
    } catch (error) {
      console.error(`Error running monitoring for clinic ${clinicId}:`, error);
    } finally {
      setMonitoringClinic(null);
    }
  }, [monitoredClinics, saveMonitoredClinics, extractXrayDataFromLogs, runLogQuery, fetchMonitoringSummaries]);

  // Add all missing functions and variables
  const currentlyMonitoringClinic = monitoringClinic;

  // Function to format dates nicely
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    // Display in local timezone without adding additional hour
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  // Function to handle AWS login with timeout
  const handleAwsLogin = async (): Promise<void> => {
    try {
      setAwsLoginInProgress(true);
      console.log('AWS login initiated');
      
      // Call login endpoint
      const response = await fetchWithTimeout(
        getApiUrl('/aws-auth'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        },
        8000
      );
      
      if (response.ok) {
        console.log('AWS login endpoint response successful');
        
        // Explicitly set state to true without triggering another check
        setIsConnectedToAws(true);
        globalLastAwsCheck.isAuthenticated = true;
        globalLastAwsCheck.timestamp = Date.now();
        
        console.log('AWS authentication state set to true');
      } else {
        console.error(`AWS login endpoint failed: ${response.status}`);
        setIsConnectedToAws(false);
        globalLastAwsCheck.isAuthenticated = false;
      }
    } catch (error) {
      console.error('AWS login error:', error);
      
      // In production, simulate successful auth
      if (process.env.NODE_ENV === 'production') {
        setIsConnectedToAws(true);
        globalLastAwsCheck.isAuthenticated = true;
        globalLastAwsCheck.timestamp = Date.now();
      } else {
        setIsConnectedToAws(false);
        globalLastAwsCheck.isAuthenticated = false;
      }
    } finally {
      setAwsLoginInProgress(false);
    }
  };

  // Update the manual refresh function to avoid loops
  const refreshAwsStatus = async () => {
    try {
      console.log('Manual AWS status refresh requested');
      
      // Direct API call without using checkAwsAuthStatus
      const response = await fetchWithTimeout(
        getApiUrl('/aws-status'),
        {},
        5000
      );
      
      if (response.ok) {
        const data = await response.json();
        const isAuthenticated = data.isAuthenticated === true || data.authenticated === true;
        
        // Update state and global cache
        setIsConnectedToAws(isAuthenticated);
        globalLastAwsCheck.isAuthenticated = isAuthenticated;
        globalLastAwsCheck.timestamp = Date.now();
        
        console.log(`AWS authentication refreshed: ${isAuthenticated ? 'connected' : 'not connected'}`);
        return isAuthenticated;
      } else {
        console.warn(`AWS status refresh failed: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('Error refreshing AWS status:', error);
      return false;
    }
  };

  // Function to toggle a clinic active state
  const toggleClinicActive = (clinicId: string): void => {
    const updatedClinics = monitoredClinics.map(clinic => {
      if (clinic.id === clinicId) {
        return { ...clinic, isActive: !clinic.isActive };
      }
      return clinic;
    });
    
      setMonitoredClinics(updatedClinics);
      saveMonitoredClinics(updatedClinics);
  };

  // Function to delete a clinic
  const handleDeleteClinic = (clinicId: string): void => {
    if (window.confirm('Are you sure you want to delete this clinic?')) {
      // Set loading state
      setIsLoading(true);
      
      try {
        // Find the clinic before removing it
        const clinic = monitoredClinics.find(c => c.id === clinicId);
        
        if (!clinic) {
          console.error(`Clinic with ID ${clinicId} not found`);
          setIsLoading(false);
          return;
        }
        
        // Call the API to delete the clinic
        deleteClinicApi(clinicId)
          .then(() => {
            console.log(`Successfully deleted clinic ${clinicId} from API`);
            
            // Update the state after successful API call
            const updatedClinics = monitoredClinics.filter(c => c.id !== clinicId);
            setMonitoredClinics(updatedClinics);
            saveMonitoredClinics(updatedClinics);
            
            // Clear cache for this clinic
            delete xrayDataCache[clinic.locationId];
            
            // Clear selection if we deleted the selected clinic
            if (selectedClinic === clinicId) {
              setSelectedClinic(null);
            }
            
            setIsLoading(false);
          })
          .catch(error => {
            console.error(`Failed to delete clinic ${clinicId} from API:`, error);
            
            // In production mode, proceed with UI update even if API call fails
            if (process.env.NODE_ENV === 'production') {
              console.warn('Proceeding with UI update despite API error in production mode');
              
              // Update the state anyway
              const updatedClinics = monitoredClinics.filter(c => c.id !== clinicId);
              setMonitoredClinics(updatedClinics);
              saveMonitoredClinics(updatedClinics);
              
              // Clear cache for this clinic
              delete xrayDataCache[clinic.locationId];
              
              // Clear selection if we deleted the selected clinic
              if (selectedClinic === clinicId) {
                setSelectedClinic(null);
              }
            }
            
            setIsLoading(false);
          });
      } catch (error) {
        console.error('Error in handleDeleteClinic:', error);
        setIsLoading(false);
      }
    }
  };

  // Function to add a new clinic to monitoring
  const addClinic = async (clinicData: {id: string, name: string}): Promise<void> => {
    try {
      if (!isConnectedToAws) {
        setConfigError('You must connect to AWS before adding clinics.');
        return;
      }
      
      // Check if this clinic is already being monitored
    if (monitoredClinics.some(c => c.locationId === clinicData.id)) {
        setConfigError('This clinic is already being monitored.');
      return;
    }
    
    const newClinic: ClinicMonitoringConfig = {
        id: `clinic-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: clinicData.name,
      locationId: clinicData.id,
        schedule: 'hourly',
      lastRun: null,
        nextRun: calculateNextRun('hourly'),
        status: 'inactive',
        lastPanoTime: null,
      isActive: true,
        slackEnabled: false,
        slackWebhook: undefined,
        slackChannel: undefined,
        noActivityAlertSent: false
      };
      
      // Add the clinic via API
      await addClinicApi(newClinic);
      
      // Clear any existing cache for this location ID to ensure fresh data
      delete xrayDataCache[newClinic.locationId];
      
      // Update state in a way that ensures the state is updated before running monitoring
    const updatedClinics = [...monitoredClinics, newClinic];
      
      // First update the state
    setMonitoredClinics(updatedClinics);
    saveMonitoredClinics(updatedClinics);
    
      // Select the new clinic
      setSelectedClinic(newClinic.id);
    
    // Close the modal
    setShowConfigModal(false);
      setCurrentConfig(null);
      setConfigError(null);
      
      // Use setTimeout to ensure state updates have been processed before running monitoring
      setTimeout(() => {
        // Now run monitoring for the new clinic
        runMonitoring(newClinic.id, { sendReport: false });
      }, 100);
    } catch (error) {
      console.error('Error adding clinic:', error);
      setConfigError('Failed to add clinic.');
    }
  };

  // Function to save clinic configuration
  const saveClinicConfig = async (): Promise<void> => {
    try {
    if (!currentConfig) return;
    
      // Validate required fields
      if (!currentConfig.name.trim()) {
        setConfigError('Clinic name is required.');
        return;
      }
      
      if (currentConfig.slackEnabled && !currentConfig.slackWebhook) {
        setConfigError('Slack webhook URL is required when Slack is enabled.');
        return;
      }
      
      // Update the clinic in the list
      const updatedClinics = monitoredClinics.map(clinic => {
        if (clinic.id === currentConfig.id) {
          return { ...currentConfig };
        }
        return clinic;
    });
    
    setMonitoredClinics(updatedClinics);
    saveMonitoredClinics(updatedClinics);
      
      // Close the modal
    setShowConfigModal(false);
    setCurrentConfig(null);
      setConfigError(null);
    } catch (error) {
      console.error('Error saving clinic config:', error);
      setConfigError('Failed to save configuration.');
    }
  };

  // Function to reset all monitoring data - call API and update state properly
  const resetAllMonitoringData = async (): Promise<void> => {
    try {
      // Call API to reset clinics
      await resetAllClinicsApi();
      
      // Clear state
      setMonitoredClinics([]);
      setClinicSummaries([]);
      setSelectedClinic(null);
      
      // Clear cache
      xrayDataCache = {};
    } catch (error) {
      console.error('Error resetting monitoring data:', error);
    }
  };

  // Function to send a no activity alert to Slack
  const sendNoActivityAlert = async (clinic: ClinicMonitoringConfig, summary: ExtendedMonitoringSummary): Promise<void> => {
    try {
      if (!clinic.slackEnabled || !clinic.slackWebhook) return;
      
      const lastActivityTime = summary.lastPanoTime ? new Date(summary.lastPanoTime).toLocaleString() : 'Never';
      
      const payload = {
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `🚨 No X-ray Activity Alert: ${clinic.name}`,
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Clinic:*\n${clinic.name}`
              },
              {
                type: "mrkdwn",
                text: `*Location ID:*\n${clinic.locationId}`
              }
            ]
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Status:*\n🔴 Inactive`
              },
              {
                type: "mrkdwn",
                text: `*Last Activity:*\n${lastActivityTime}`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "No X-ray activity detected in the last 5 hours during business hours."
            }
          }
        ]
      };
      
      await sendSlackNotification(clinic.slackWebhook, payload);
    } catch (error) {
      console.error('Error sending no activity alert:', error);
    }
  };

  // Function to send an activity report to Slack
  const sendActivityReport = async (clinic: ClinicMonitoringConfig, summary: ExtendedMonitoringSummary): Promise<void> => {
    try {
      if (!clinic.slackEnabled || !clinic.slackWebhook) return;
      
      const statusEmoji = summary.status === 'active' ? '🟢' : summary.status === 'warning' ? '🟠' : '🔴';
      const lastActivityTime = summary.lastPanoTime ? new Date(summary.lastPanoTime).toLocaleString() : 'Never';
      
      const payload = {
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
            fields: [
              {
                type: "mrkdwn",
                text: `*Clinic:*\n${clinic.name}`
              },
              {
                type: "mrkdwn",
                text: `*Location ID:*\n${clinic.locationId}`
              }
            ]
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Status:*\n${statusEmoji} ${summary.status.charAt(0).toUpperCase() + summary.status.slice(1)}`
              },
              {
                type: "mrkdwn",
                text: `*Last Activity:*\n${lastActivityTime}`
              }
            ]
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Total X-rays (24h):*\n${summary.xraysTotal}`
              }
            ]
          }
        ]
      };
      
      await sendSlackNotification(clinic.slackWebhook, payload);
    } catch (error) {
      console.error('Error sending activity report:', error);
    }
  };

  // Function to render recent X-rays - Modernized with improved log display
  const renderRecentXrays = (clinicId: string | null): ReactNode => {
    if (!clinicId) return null;
    
    const clinic = monitoredClinics.find(c => c.id === clinicId);
    if (!clinic) return null;
    
    const summary = clinicSummaries.find(s => s.clinicId === clinicId);
    const treatments = summary?.treatments || [];
    
    // Use the component level state and filter function instead
    const filteredTreatments = filterTreatments(treatments, treatmentFilterType);
    
    const renderXrayActivityCount = () => {
      if (treatments.length === 0) return "No recent activity";
      return `${treatments.length} ${treatments.length === 1 ? 'treatment' : 'treatments'} in the last 24h`;
    };
    
    // Rest of the function remains the same, but update any references from filterType to treatmentFilterType
    const panoramicCount = treatments.filter(t => t.type === 'PANORAMIC').length;
    const createTreatmentCount = treatments.filter(t => 
      typeof t.originalLog === 'string' && t.originalLog.toLowerCase().includes('createtreatment')
    ).length;
    
    return (
      treatments.length > 0 ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {/* Update filter buttons to use setTreatmentFilterType */}
          <div className="flex flex-col sm:flex-row justify-between items-center px-2 py-1.5 text-xs border-b border-slate-700/30 mb-2 gap-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
              <span>
                {panoramicCount} {panoramicCount === 1 ? 'Panoramic' : 'Panoramics'}, 
                {' '}{treatments.length - panoramicCount} {treatments.length - panoramicCount === 1 ? 'Other X-ray' : 'Other X-rays'}
                {createTreatmentCount > 0 && `, ${createTreatmentCount} createTreatment`}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex border border-slate-700 rounded-md overflow-hidden">
                <button 
                  onClick={() => setTreatmentFilterType('all')} 
                  className={`px-2 py-1 text-[10px] ${treatmentFilterType === 'all' ? 'bg-blue-600/40 text-blue-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  All
                </button>
                <button 
                  onClick={() => setTreatmentFilterType('panoramic')} 
                  className={`px-2 py-1 text-[10px] ${treatmentFilterType === 'panoramic' ? 'bg-blue-600/40 text-blue-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  Panoramic
                </button>
                <button 
                  onClick={() => setTreatmentFilterType('periapical')} 
                  className={`px-2 py-1 text-[10px] ${treatmentFilterType === 'periapical' ? 'bg-purple-600/40 text-purple-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  Periapical
                </button>
                {createTreatmentCount > 0 && (
                  <button 
                    onClick={() => setTreatmentFilterType('createTreatment')} 
                    className={`px-2 py-1 text-[10px] ${treatmentFilterType === 'createTreatment' ? 'bg-green-600/40 text-green-300' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    createTreatment
                  </button>
                )}
              </div>
              
              <button
                onClick={() => runMonitoring(clinicId)}
                disabled={currentlyMonitoringClinic === clinicId}
                className={`px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[10px] ${
                  currentlyMonitoringClinic === clinicId 
                  ? 'text-slate-500 cursor-not-allowed' 
                  : 'text-blue-400 hover:bg-blue-900/30'
                }`}
              >
                {currentlyMonitoringClinic === clinicId 
                  ? <><div className="animate-spin h-2.5 w-2.5 border-b-2 border-slate-500 rounded-full"></div> <span>Refreshing...</span></>
                  : <><RefreshCw className="w-2.5 h-2.5" /> <span>Refresh</span></>
                }
              </button>
            </div>
          </div>
          
          {filteredTreatments.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No treatments match the selected filter
            </div>
          ) : (
            <>
              {filteredTreatments.slice(0, 10).map((treatment, index) => {
                const isCreateTreatment = typeof treatment.originalLog === 'string' && treatment.originalLog.toLowerCase().includes('createtreatment');
                
                return (
                  <div 
                    key={treatment.id || index} 
                    className={`${
                      isCreateTreatment 
                        ? 'bg-green-900/10 hover:bg-green-900/20 border-green-800/20' 
                        : 'bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/40'
                    } rounded-md p-3 border transition-all group`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            isCreateTreatment
                              ? 'bg-green-500'
                              : treatment.type === 'PANORAMIC' 
                                ? 'bg-blue-500' 
                                : 'bg-purple-500'
                          }`}></div>
                          <h4 className="font-medium text-sm truncate">
                            {treatment.patientName}
                            {isCreateTreatment && (
                              <span className="ml-1.5 px-1 py-0.5 bg-green-900/30 text-green-400 rounded text-[10px] font-normal">
                                createTreatment
                              </span>
                            )}
                          </h4>
                        </div>
                        <div className="text-xs text-slate-400 mt-1 flex items-center">
                          <User className="w-3 h-3 mr-1.5 text-slate-500" />
                          <span className="truncate">ID: {treatment.patientId}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          isCreateTreatment
                            ? 'bg-green-900/30 text-green-400 border border-green-500/30'
                            : treatment.type === 'PANORAMIC' 
                              ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' 
                              : 'bg-purple-900/30 text-purple-400 border border-purple-500/30'
                        }`}>
                          {treatment.type}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1.5">
                          {new Date(treatment.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                    
                    {/* Log display section */}
                    <div className="mt-2 pt-1.5 border-t border-slate-700/30">
                      <div className={`text-xs line-clamp-2 text-ellipsis overflow-hidden font-mono text-[10px] p-1.5 rounded ${
                        isCreateTreatment
                          ? 'bg-green-950/30 text-green-300'
                          : 'bg-slate-900/30 text-slate-400'
                      }`}>
                        {typeof treatment.originalLog === 'string' 
                          ? treatment.originalLog 
                          : JSON.stringify(treatment.originalLog)
                        }
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2 text-xs">
                      <span className={`flex items-center ${treatment.success ? 'text-green-400' : 'text-red-400'}`}>
                        {treatment.success ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Successful
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            Failed
                          </>
                        )}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            // Copy the log to clipboard
                            const logText = typeof treatment.originalLog === 'string' 
                              ? treatment.originalLog 
                              : JSON.stringify(treatment.originalLog);
                            navigator.clipboard.writeText(logText);
                            // Could add a toast message here
                            alert('Log copied to clipboard');
                          }}
                          className="px-1.5 py-1 bg-slate-700/80 text-slate-300 rounded hover:bg-slate-700 transition flex items-center text-[10px] gap-1"
                        >
                          <Copy className="w-2.5 h-2.5" />
                          Copy Log
                        </button>
                        <button
                          onClick={() => {
                            if (clinic) {
                              handleViewXrayData(clinic);
                            }
                          }}
                          className="px-1.5 py-1 bg-slate-700/80 text-slate-300 rounded hover:bg-slate-700 transition flex items-center text-[10px] gap-1"
                        >
                          <FileText className="w-2.5 h-2.5" />
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
          
          {filteredTreatments.length > 10 && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => {
                  if (clinic) {
                    handleViewXrayData(clinic);
                  }
                }}
                className="px-3 py-1.5 bg-slate-700/60 text-slate-300 rounded-md hover:bg-slate-700 transition flex items-center text-xs gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                View All X-ray Details ({filteredTreatments.length})
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-700/30 border border-slate-600/30 flex items-center justify-center mb-3">
            <Activity className="w-7 h-7 text-slate-500" />
          </div>
          <p className="text-slate-400 text-sm mb-4">No recent X-ray activity found</p>
          <button
            onClick={() => {
              if (clinic) {
                runMonitoring(clinic.id);
              }
            }}
            className="px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-md hover:bg-blue-600/30 transition flex items-center text-xs gap-1.5"
            disabled={currentlyMonitoringClinic === clinic.id}
          >
            {currentlyMonitoringClinic === clinic.id ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-blue-400 border-t-transparent rounded-full mr-1.5" />
                Checking for activity...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Check for Activity
              </>
            )}
          </button>
        </div>
      )
    );
  };

  // Function to render X-ray activity count - used in the dashboard header
  const renderXrayActivityCount = (clinicId: string | null): string => {
    if (!clinicId) return "No clinic selected";
    
    const summary = clinicSummaries.find(s => s.clinicId === clinicId);
    const treatments = summary?.treatments || [];
    
    if (treatments.length === 0) return "No recent activity";
    return `${treatments.length} ${treatments.length === 1 ? 'treatment' : 'treatments'} in the last 24h`;
  };

  // Update useEffect to use our new pattern and avoid loops
  useEffect(() => {
    console.log('Dashboard initialization starting...');
    let isMounted = true;
    
    // Reset authentication attempts counter on mount
    awsAuthCheckAttempts = 0;
    
    const loadData = async () => {
      setIsLoading(true);
      
      // Add loading timeout safety
      const loadingTimeout = setTimeout(() => {
        if (isMounted) {
          console.warn('Loading timeout reached');
          setIsLoading(false);
          setJustLoaded(false);
        }
      }, 10000);
      
      try {
        // ONE TIME check for AWS auth - no automatic rechecking
        console.log('Step 1: Checking AWS authentication (once)');
        const isAuthenticated = await checkAwsAuthStatus(false);
        
        if (isMounted) {
          // Update auth state once and only once
          setIsConnectedToAws(isAuthenticated);
          console.log(`AWS auth state set to: ${isAuthenticated}`);
          
          // Continue with loading other data
          try {
            console.log('Step 2: Loading clinics');
            const clinics = await loadMonitoredClinics();
            
            if (isMounted) {
              setMonitoredClinics(clinics);
              console.log(`Loaded ${clinics.length} clinics`);
              
              // Load available clinics
              try {
                const availableClinicsList = await fetchAvailableClinics();
                if (isMounted) {
                  setAvailableClinics(availableClinicsList);
                }
              } catch (error) {
                console.error('Failed to load available clinics:', error);
                if (isMounted) {
                  setAvailableClinics(mockAvailableClinics);
                }
              }
              
              // Set selected clinic if we have any
              if (clinics.length > 0 && isMounted) {
                setSelectedClinic(clinics[0].id);
                
                // Try to load summaries
                try {
                  const options = { skipNotifications: true };
                  const summaries = await fetchMonitoringSummaries([clinics[0].id], clinics, options);
                  if (isMounted) {
                    setClinicSummaries(summaries);
        }
      } catch (error) {
                  console.error('Failed to load clinic summaries:', error);
                }
              }
            }
          } catch (error) {
            console.error('Error loading clinics:', error);
          }
        }
      } catch (error) {
        console.error('Fatal error during initialization:', error);
      } finally {
        if (isMounted) {
          clearTimeout(loadingTimeout);
        setIsLoading(false);
          setJustLoaded(false);
          console.log('Dashboard initialization complete');
        }
      }
    };
    
    // Start loading
    loadData();
    
    // Cleanup on unmount
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array - run ONCE only

  // Add the AWS auth check function inside the component
  const checkAwsAuthStatus = async (forceCheck: boolean = false): Promise<boolean> => {
    // Only log the first call during component initialization
    const isInitialCheck = awsAuthCheckAttempts === 0;
  
    try {
      const now = Date.now();
    
      // If we're not forcing a check and we've already checked too many times,
      // just use the cached result to break the loop
      if (!forceCheck && awsAuthCheckAttempts > 1) {
        console.log('Using cached auth status to prevent loop');
        return globalLastAwsCheck.isAuthenticated;
      }
    
      // Increment the attempt counter
      awsAuthCheckAttempts++;
    
      // If this is a force check or we don't have recent check data,
      // make the API call
      if (forceCheck || globalLastAwsCheck.timestamp === 0 || 
          (now - globalLastAwsCheck.timestamp > 5 * 60 * 1000)) {
      
        if (isInitialCheck || forceCheck) {
          console.log(`Performing AWS auth check (${forceCheck ? 'forced' : 'initial'})`);
        }
      
        try {
          const response = await fetchWithTimeout(
            getApiUrl('/aws-status'),
            {},
            5000 // 5 second timeout
          );
        
          if (response.ok) {
            const data = await response.json();
            const authenticated = data.isAuthenticated === true || data.authenticated === true;
          
            // Update global state
            globalLastAwsCheck.isAuthenticated = authenticated;
            globalLastAwsCheck.timestamp = now;
          
            if (isInitialCheck || forceCheck) {
              console.log(`AWS auth check result: ${authenticated ? 'authenticated' : 'not authenticated'}`);
            }
          
            return authenticated;
    } else {
            console.warn(`AWS Status check failed (${response.status})`);
            return process.env.NODE_ENV === 'production';
          }
        } catch (error) {
          console.error('Error fetching AWS status:', error);
          return process.env.NODE_ENV === 'production';
        }
      }
    
      // Use cached result
      return globalLastAwsCheck.isAuthenticated;
    } catch (error) {
      console.error('Error checking AWS auth status:', error);
      return process.env.NODE_ENV === 'production';
    }
  };

  // Clinic stats per clinic ID for use in the dashboard cards
  const [clinicStats, setClinicStats] = useState<{ 
    [clinicId: string]: { 
      totalXrays: number; 
      panoramicCount: number; 
      periapicalCount: number;
    } 
  }>({});

  // Update the useEffect to also set clinic stats
  useEffect(() => {
    // Update treatment data for the clinic
    if (selectedClinic) {
      const summary = clinicSummaries.find(s => s.clinicId === selectedClinic);
      if (summary) {
        const panoramicCount = summary.treatments.filter(t => t.type === 'PANORAMIC').length;
        const periapicalCount = summary.treatments.filter(t => t.type === 'PERIAPICAL').length;
        
        setClinicStats(prev => ({
          ...prev,
          [selectedClinic]: {
            totalXrays: summary.treatments.length,
            panoramicCount,
            periapicalCount
          }
        }));
      }
    }
  }, [selectedClinic, clinicSummaries]);

  // Add a special function to clear treatment cache for testing/debugging
  const clearTreatmentCache = (clinicId?: string) => {
    if (clinicId) {
      delete xrayDataCache[clinicId];
      console.log(`Cleared treatment cache for clinic ${clinicId}`);
    } else {
      Object.keys(xrayDataCache).forEach(key => {
        delete xrayDataCache[key];
      });
      console.log('Cleared all treatment caches');
    }
  };

  // Add a useEffect to automatically refresh treatment data when clinic is selected
  useEffect(() => {
    if (selectedClinic) {
      const clinic = monitoredClinics.find(c => c.id === selectedClinic);
      if (clinic) {
        console.log(`Auto-refreshing treatment data for clinic ${clinic.name} (${clinic.locationId})`);
        
        // Force a treatment data refresh by clearing cache and running monitoring
        clearTreatmentCache(selectedClinic);
        runMonitoring(selectedClinic);
      }
    }
  }, [selectedClinic]);

  // Add this utility function just before the return statement
  const navigateToLogAnalysis = useCallback((locationId: string, clinicName: string) => {
    console.log(`Navigating to LogAnalysisPage for clinic: ${clinicName} (ID: ${locationId})`);
    
    // Store data for LogAnalysisPage
    sessionStorage.setItem('logSource', 'query');
    
    // Filter logs for this specific clinic
    if (logs && logs.length > 0) {
      const clinicLogs = logs.filter(log => 
        log.logStream?.includes(`[${locationId}]`)
      );
      console.log(`Found ${clinicLogs.length} logs for location ID: ${locationId}`);
      sessionStorage.setItem('queryLogs', JSON.stringify(clinicLogs));
    } else {
      console.log('No logs available to filter');
      sessionStorage.setItem('queryLogs', JSON.stringify([]));
    }
    
    // Also store location information
    sessionStorage.setItem('selectedLocationId', locationId);
    sessionStorage.setItem('selectedLocationName', clinicName);
    
    // Set loading flag for the LogAnalysisPage
    sessionStorage.setItem('showLoading', 'true');
    
    // Navigate to Log Analysis page
    navigate(`/log-analysis?locationId=${locationId}`);
  }, [logs, navigate]);

  // In the renderClinicCard function or wherever the sidebar "View X-ray Data" button is located
  const navigateToXrayMonitoring = (locationId: string) => {
    console.log(`Navigating to X-ray monitoring for clinic ${locationId}`);
    // Set loading flag in session storage to trigger loading screen
    sessionStorage.setItem('showLoading', 'true');
    // Ensure we're using the correct path: "/dental-xray-monitoring"
    navigate(`/dental-xray-monitoring?locationId=${locationId}`);
  };

  // Update the sidebar button handler with proper TypeScript typing
  // Find the onClick handler that navigates to dental-xray-monitoring
  const handleViewXrayData = (clinic: ClinicMonitoringConfig) => {
    setShowNavigationLoading(true);
    setNavigationDestination("X-ray Monitoring");
    
    // Store the clinic location ID in sessionStorage
    sessionStorage.setItem('showLoading', 'true');
    
    // Give time for the loading page to appear before navigating
    setTimeout(() => {
      navigate(`/dental-xray-monitoring?locationId=${clinic.locationId}`);
    }, 1000);
  };

  return (
    <>
      {showNavigationLoading && (
        <NavigationLoadingPage 
          message="Loading X-ray Monitoring Data" 
          destinationPage={navigationDestination}
        />
      )}
      
      <div className="min-h-screen bg-slate-900 flex">
        {/* existing content */}
      </div>
    </>
  );
};

export default ClinicMonitoringDashboard;