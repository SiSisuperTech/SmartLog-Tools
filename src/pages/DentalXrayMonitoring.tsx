import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import {
  ChevronLeft,
  Search,
  AlertCircle,
  RefreshCw,
  Download,
  Bell,
  FileText,
  AlertTriangle,
  X,
  Calendar,
  Camera,
  Settings,
  Server,
  Users,
  HardDrive,
  Activity,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Monitor,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Type,
  Wrench,
  Clock,
  Shield,
  Zap,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Heart,
  Radio,
  Cpu,
  Workflow,
  Upload,
  BarChart as BarChartIcon
} from 'lucide-react';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

import { format, parseISO, subHours, subDays, isValid, differenceInDays } from 'date-fns';
import LoadingPage from '../components/LoadingPage';

// Extended types to fix TypeScript errors
interface LogEntry {
  timestamp: string;
  message: string;
  logStream?: string;
  severity: 'info' | 'warning' | 'error';
  id?: string;
}

// Interface for X-ray config structure
interface XrayConfig {
  name: string;
  version: string;
  dbConfig?: {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  pmBridgePath: string;
  romexisRadioPath?: string;
  vatechDbFolderPath?: string;
  carestreamRadioPath?: string;
  isFormattedPatientIdMode?: boolean;
  isValid: boolean;
}

interface TreatmentInfo {
  timestamp: string;
  patientId: string;
  patientName: string;
  type: string;
  success: boolean;
}

// Event types with categories and severities
const EVENT_TYPES = [
  { name: 'System Startup', category: 'system', severity: 'info' },
  { name: 'X-ray Taken', category: 'operation', severity: 'info' },
  { name: 'Configuration Change', category: 'system', severity: 'warning' },
  { name: 'Patient Data Error', category: 'data', severity: 'error' },
  { name: 'Connection Lost', category: 'network', severity: 'error' },
  { name: 'Database Query', category: 'database', severity: 'info' },
  { name: 'Software Update', category: 'system', severity: 'info' },
  { name: 'User Login', category: 'security', severity: 'info' },
  { name: 'Storage Warning', category: 'system', severity: 'warning' },
  { name: 'Processing Error', category: 'operation', severity: 'error' }
];

// Health check categories
const HEALTH_CATEGORIES = [
  'Network', 'Database', 'Storage', 'Performance', 'Security'
];

// Enhanced color palette for visualizations
const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6',
  '#84cc16', '#f97316'
];

const DentalXrayMonitoring: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Extract locationId from URL query parameters
  const queryParams = new URLSearchParams(location.search);
  const locationId = queryParams.get('locationId');
  
  console.log(`DentalXrayMonitoring initialized with locationId: ${locationId || 'null'}`);
  
  // Core state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logSource, setLogSource] = useState<'aws' | 'manual' | 'query' | null>(null);
  
  // UI state
  const [expandedSections, setExpandedSections] = useState({
    status: true,
    health: true,
    activity: true,
    alerts: true
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [fontSize, setFontSize] = useState('normal');
  const [darkMode, setDarkMode] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(30); // seconds
  
  // Monitoring state
  const [xrayConfig, setXrayConfig] = useState<XrayConfig | null>(null);
  const [treatments, setTreatments] = useState<TreatmentInfo[]>([]);
  const [systemStatus, setSystemStatus] = useState<'online' | 'offline' | 'warning' | 'error'>('online');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [healthScores, setHealthScores] = useState<{category: string, score: number}[]>([]);
  const [alerts, setAlerts] = useState<{id: string, message: string, severity: string, timestamp: string}[]>([]);
  const [systemMetrics, setSystemMetrics] = useState({
    xrayCount: 0,
    patientCount: 0,
    errorCount: 0,
    warningCount: 0,
    successRate: 0,
    avgProcessingTime: 0
  });
  
  // Update the useEffect
  useEffect(() => {
    // The locationId is already extracted at the component level  
    if (locationId) {
      console.log(`DentalXrayMonitoring initialized with locationId: ${locationId}`);
      
      // If we were passed a locationId, we might have filtered logs in sessionStorage
      const logSourceStr = sessionStorage.getItem('logSource');
      if (logSourceStr) {
        setLogSource(logSourceStr as 'aws' | 'manual' | 'query' | null);
      }
    }
    
    // Check if we should show loading (set by ClinicMonitoringDashboard)
    const shouldShowLoading = sessionStorage.getItem('showLoading') === 'true';
    
    // If showLoading is set, make sure we start with isLoading true
    if (shouldShowLoading) {
      setIsLoading(true);
      // Clear the flag so it doesn't persist between navigations
      sessionStorage.removeItem('showLoading');
    }
    
    // Let the normal loading process happen but ensure loading state is shown
    setTimeout(() => setIsLoading(false), 1500); // Show loading animation for a bit
  }, [locationId]);

  // Format timestamp for display - Use browser's local timezone
  const formatTimestamp = useCallback((timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      // Display directly in local timezone without adjustments
      return date.toLocaleString() + ' (Local time)';
    } catch (error) {
      return timestamp;
    }
  }, []);

  // Toggle section expansion
  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  // Toggle full screen mode
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
  }, []);

  // Font size handler
  const cycleFontSize = useCallback(() => {
    setFontSize(prev => {
      if (prev === 'small') return 'normal';
      if (prev === 'normal') return 'large';
      return 'small';
    });
  }, []);

  // Get font size class
  const getFontSizeClass = useCallback(() => {
    switch (fontSize) {
      case 'small': return 'text-xs';
      case 'large': return 'text-lg';
      default: return 'text-sm';
    }
  }, [fontSize]);
  
  // Parse timestamps with safety checks
  const parseTimestamp = useCallback((timestamp: string): Date | null => {
    if (!timestamp) return null;
    
    try {
      // First, ensure timestamp is in ISO format if it's in "YYYY-MM-DD HH:MM:SS" format
      let isoTimestamp = timestamp;
      if (typeof timestamp === 'string' && timestamp.includes(' ')) {
        isoTimestamp = timestamp.replace(' ', 'T') + 'Z';
      }
      
      // Regular Date parsing (works for ISO strings)
      const date = new Date(isoTimestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Try numeric timestamp (milliseconds since epoch)
      if (/^\\d+$/.test(String(timestamp))) {
        const numericDate = new Date(parseInt(String(timestamp)));
        if (!isNaN(numericDate.getTime())) {
          return numericDate;
        }
      }
      
      return null;
    } catch (e) {
      console.error('Error parsing timestamp:', timestamp, e);
      return null;
    }
  }, []);
  
  // Extract patient information from logs with proper pattern matching
  const extractPatientData = useCallback((logEntries: LogEntry[]) => {
    // Array to store valid treatments
    const extractedTreatments: TreatmentInfo[] = [];
    
    // Regular expression to match proper patient name pattern (contains "****ddd****")
    const patientNameRegex = /for\s+([A-Za-z*]+\d+[A-Za-z*]+)/;
    
    // Filter logs related to treatments and extract proper patient info
    const treatmentLogs = logEntries.filter(log => 
      log.message.includes('createTreatment') || 
      log.message.includes('Treatment created')
    );
    
    treatmentLogs.forEach((log, index) => {
      const messageMatch = log.message.match(patientNameRegex);
      
      // Only count as a valid treatment if it matches the pattern
      if (messageMatch) {
        const patientName = messageMatch[1];
        
        // Verify the name follows the pattern with asterisks and digits
        if (/[*]+\d+[*]+/.test(patientName)) {
          extractedTreatments.push({
            timestamp: log.timestamp,
            patientId: `patient-${index}`,
            patientName,
            type: 'Panoramic X-ray',
            success: !log.message.includes('failed') && !log.message.includes('error')
          });
        }
      }
    });
    
    return extractedTreatments;
  }, []);
  
  // Process logs to extract system health metrics
  const processSystemHealth = useCallback((logEntries: LogEntry[]) => {
    // Count errors and warnings
    const errors = logEntries.filter(log => log.severity === 'error');
    const warnings = logEntries.filter(log => log.severity === 'warning');
    
    // Extract valid treatments using the pattern matching
    const validTreatments = extractPatientData(logEntries);
    
    // Calculate processing times (where available)
    const processingTimes: number[] = [];
    logEntries.forEach(log => {
      if (log.message.includes('Processing time:')) {
        const match = log.message.match(/Processing time:\s*(\d+\.?\d*)(\s*s|ms)?/i);
        if (match) {
          let time = parseFloat(match[1]);
          // Convert ms to seconds if necessary
          if (match[2] && match[2].trim().toLowerCase() === 'ms') {
            time /= 1000;
          }
          processingTimes.push(time);
        }
      }
    });
    
    // Calculate success rate
    const attemptedXrays = logEntries.filter(log => 
      log.message.includes('Sending data') || 
      log.message.includes('Processing X-ray') ||
      log.message.includes('createTreatment')
    ).length;
    
    const successRate = attemptedXrays > 0 
      ? (validTreatments.length / attemptedXrays) * 100 
      : 100;
    
    // Calculate average processing time
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;
    
    // Update system metrics
    setSystemMetrics({
      xrayCount: validTreatments.length,
      patientCount: new Set(validTreatments.map(t => t.patientName)).size,
      errorCount: errors.length,
      warningCount: warnings.length,
      successRate,
      avgProcessingTime
    });
    
    // Set treatments
    setTreatments(validTreatments);
    
    // Generate health scores based on log analysis
    const healthScores = [
      { 
        category: 'Network', 
        score: calculateHealthScore(logEntries, 'network')
      },
      { 
        category: 'Database', 
        score: calculateHealthScore(logEntries, 'database')
      },
      { 
        category: 'Storage', 
        score: calculateHealthScore(logEntries, 'storage')
      },
      { 
        category: 'Performance', 
        score: successRate > 95 ? 90 : successRate > 85 ? 70 : 50
      },
      { 
        category: 'Security', 
        score: calculateHealthScore(logEntries, 'security')
      }
    ];
    
    setHealthScores(healthScores);
    
    // Set system status based on errors/warnings
    if (errors.length > 5) {
      setSystemStatus('error');
    } else if (warnings.length > 10 || errors.length > 0) {
      setSystemStatus('warning');
    } else {
      setSystemStatus('online');
    }
    
    // Generate alerts
    const newAlerts = [
      ...errors.slice(0, 5).map((log, index) => ({
        id: `error-${index}`,
        message: log.message,
        severity: 'error',
        timestamp: log.timestamp
      })),
      ...warnings.slice(0, 5).map((log, index) => ({
        id: `warning-${index}`,
        message: log.message,
        severity: 'warning',
        timestamp: log.timestamp
      }))
    ];
    
    // Sort by timestamp (newest first)
    newAlerts.sort((a, b) => {
      const dateA = parseTimestamp(a.timestamp) || new Date(0);
      const dateB = parseTimestamp(b.timestamp) || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    setAlerts(newAlerts);
  }, [extractPatientData, parseTimestamp]);
  
  // Helper function to calculate health score based on log patterns
  const calculateHealthScore = useCallback((logs: LogEntry[], category: string): number => {
    // Define patterns for each category
    const patterns: {[key: string]: RegExp[]} = {
      network: [/network/i, /connection/i, /timeout/i, /socket/i, /offline/i],
      database: [/database/i, /query/i, /sql/i, /db error/i],
      storage: [/storage/i, /disk/i, /file/i, /space/i],
      security: [/authentication/i, /login/i, /permission/i, /access/i],
    };
    
    // Count relevant errors and warnings
    const relevantLogs = logs.filter(log => 
      (log.severity === 'error' || log.severity === 'warning') &&
      patterns[category].some(pattern => pattern.test(log.message))
    );
    
    // Calculate score (fewer errors = higher score)
    const baseScore = 100;
    const errorPenalty = 15; // Points to deduct per error
    const warningPenalty = 5; // Points to deduct per warning
    
    const errors = relevantLogs.filter(log => log.severity === 'error').length;
    const warnings = relevantLogs.filter(log => log.severity === 'warning').length;
    
    let score = baseScore - (errors * errorPenalty) - (warnings * warningPenalty);
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }, []);
  
  // Get activity data for timeline visualization
  const getActivityData = useMemo(() => {
    const activityByHour: {[key: string]: number} = {};
    
    // Initialize all hours with 0
    for (let i = 0; i < 24; i++) {
      activityByHour[i] = 0;
    }
    
    // Count activities by hour
    treatments.forEach(treatment => {
      try {
        const date = new Date(treatment.timestamp);
        const hour = date.getHours();
        activityByHour[hour] = (activityByHour[hour] || 0) + 1;
      } catch (e) {
        // Skip invalid dates
      }
    });
    
    // Convert to array for chart
    return Object.entries(activityByHour).map(([hour, count]) => ({
      hour: `${hour}:00`,
      xrays: count
    }));
  }, [treatments]);
  
  // Get hourly error distribution
  const getErrorDistribution = useMemo(() => {
    const errorsByHour: {[key: string]: number} = {};
    
    // Initialize all hours with 0
    for (let i = 0; i < 24; i++) {
      errorsByHour[i] = 0;
    }
    
    // Count errors by hour
    logs.filter(log => log.severity === 'error').forEach(log => {
      try {
        const date = new Date(log.timestamp);
        const hour = date.getHours();
        errorsByHour[hour] = (errorsByHour[hour] || 0) + 1;
      } catch (e) {
        // Skip invalid dates
      }
    });
    
    // Convert to array for chart
    return Object.entries(errorsByHour).map(([hour, count]) => ({
      hour: `${hour}:00`,
      errors: count
    }));
  }, [logs]);
  
  // Normalize log timestamps for consistency
  const normalizeLogTimestamps = useCallback((inputLogs: LogEntry[]): LogEntry[] => {
    return inputLogs.map(log => {
      // Handle CloudWatch timestamp format
      if (log.timestamp && typeof log.timestamp === 'string' && log.timestamp.includes(' ')) {
        return {
          ...log,
          timestamp: log.timestamp.replace(' ', 'T') + 'Z'
        };
      }
      return log;
    });
  }, []);
  
  // Load logs on component mount
  useEffect(() => {
    // Function to load real logs from CloudWatch
    const loadLogs = async () => {
      setIsLoading(true);
      setError(null);
      
      console.log("Loading X-ray monitoring data. LocationId:", locationId);
      
      try {
        // Check if we have monitoring data in local storage for this clinic
        let monitoringData = null;
        try {
          const monitoringDataStr = localStorage.getItem('monitoredClinicsData');
          if (monitoringDataStr) {
            const allData = JSON.parse(monitoringDataStr);
            
            // Find the clinic with this locationId
            const matchingClinic = locationId ? 
              allData.find((clinic: any) => clinic.locationId === locationId) : 
              null;
            
            if (matchingClinic) {
              console.log(`Found monitoring data for clinic with locationId ${locationId}:`, matchingClinic);
              monitoringData = matchingClinic;
            } else if (locationId) {
              console.log(`No monitoring data found for locationId ${locationId}`);
            } else {
              console.log(`No locationId provided, will use general logs`);
            }
          }
        } catch (error) {
          console.error('Error parsing monitoring data:', error);
        }
        
        // Check if we have logs in session storage from the LogAnalysisPage
        const source = sessionStorage.getItem('logSource');
        let storedLogs: LogEntry[] = [];
        
        if (source) {
          // Try different storage formats
          if (source === 'manual') {
            // Load manually uploaded logs
            const logStorage = sessionStorage.getItem('manualLogs');
            if (logStorage) {
              const parsed = JSON.parse(logStorage);
              storedLogs = Array.isArray(parsed) ? parsed : [parsed];
            }
          } 
          else if (source === 'aws' || source === 'query') {
            // Check if logs are chunked
            const chunksCount = sessionStorage.getItem(`${source}Logs_chunks`);
            
            if (chunksCount) {
              console.log(`Loading chunked logs: ${chunksCount} chunks`);
              
              // Load logs from chunks
              const count = parseInt(chunksCount);
              
              for (let i = 0; i < count; i++) {
                const chunkStr = sessionStorage.getItem(`${source}Logs_chunk_${i}`);
                if (chunkStr) {
                  try {
                    const chunk = JSON.parse(chunkStr);
                    storedLogs = storedLogs.concat(chunk);
                  } catch (e) {
                    console.error(`Error parsing chunk ${i}:`, e);
                  }
                }
              }
              
              console.log(`Loaded ${storedLogs.length} logs from ${count} chunks`);
            } else {
              // Load AWS logs
              const logStorage = sessionStorage.getItem(`${source}Logs`);
              if (logStorage) {
                try {
                  const parsed = JSON.parse(logStorage);
                  
                  // Handle direct array format (new format)
                  if (Array.isArray(parsed)) {
                    console.log('Found direct array format logs', parsed.length);
                    storedLogs = parsed;
                  }
                  // Handle wrapped results format (legacy format)
                  else if (parsed.results && Array.isArray(parsed.results)) {
                    console.log('Found results-wrapped logs', parsed.results.length);
                    storedLogs = parsed.results;
                  } else {
                    console.log('Unknown logs format:', parsed);
                  }
                } catch (e) {
                  console.error('Error parsing AWS logs:', e);
                }
              }
            }
          }
        }
        
        // Filter logs by locationId if provided
        if (locationId && storedLogs.length > 0) {
          console.log(`Filtering ${storedLogs.length} logs for locationId: ${locationId}`);
          storedLogs = storedLogs.filter(log => 
            log.logStream?.includes(`[${locationId}]`)
          );
          console.log(`Found ${storedLogs.length} logs for locationId: ${locationId}`);
        }
        
        // If we have logs, process them
        if (storedLogs.length > 0) {
          setLogs(storedLogs);
          setFilteredLogs(storedLogs);
          
          // Extract X-ray data
          const xrays = extractPatientData(storedLogs);
          if (xrays.length > 0) {
            setTreatments(xrays);
            setSystemMetrics(prev => ({
              ...prev,
              xrayCount: xrays.length,
              patientCount: [...new Set(xrays.map(x => x.patientId))].length
            }));
          } else {
            console.log('No X-ray data found in logs');
            setTreatments([]);
          }
          
          // Update status based on log analysis
          processSystemHealth(storedLogs);
        } else {
          console.log('No logs found');
          setTreatments([]);
        }
        
        // Set log source to indicate data origin
        setLogSource(source as 'aws' | 'manual' | 'query' | null);
        
        // Update timestamps
        setLastUpdated(new Date());
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading logs:', error);
        setError(`Failed to load logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLogs([]);
        setFilteredLogs([]);
        setIsLoading(false);
      }
    };

    loadLogs();
    
    // Set up refresh interval if enabled
    let intervalId: NodeJS.Timeout | null = null;
    if (refreshInterval) {
      intervalId = setInterval(() => {
        loadLogs();
      }, refreshInterval * 1000);
    }
    
    // Clean up interval on unmount
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [locationId, processSystemHealth, refreshInterval]);
  
  // Loading state with logo
  if (isLoading) {
    return (
      <LoadingPage 
        message="Loading X-ray Monitoring Data" 
        showProgress={true}
        isLoading={isLoading}
      />
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-800 rounded-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl text-white font-medium mb-2">Error Loading Dashboard</h2>
          <p className="text-slate-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  // No logs state
  if (!logs.length) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 text-white flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-amber-400 mb-6" />
          <h2 className="text-2xl font-semibold mb-4">No Data Available</h2>
          <p className="text-slate-300 mb-6">
            There are no logs available for monitoring. Please upload logs or query a log source.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate('/log-query')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Query Logs
            </button>
            <button
              onClick={() => navigate('/log-analysis')}
              className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition"
            >
              Back to Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-gray-100'} ${isFullScreen ? 'p-0' : 'p-4 md:p-6'} ${darkMode ? 'text-white' : 'text-gray-900'} transition-all duration-300`}
    >
      <div className={`${isFullScreen ? 'max-w-full' : 'max-w-6xl'} mx-auto`}>
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/log-analysis')}
              className={`mr-4 ${darkMode ? 'text-white/80 hover:text-white' : 'text-gray-600 hover:text-gray-900'} transition-colors`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold flex items-center">
              <Monitor className="w-6 h-6 mr-2 text-blue-400" />
              Dental X-ray Monitoring
              <span 
                className={`ml-3 px-2 py-1 rounded-full text-xs ${
                  systemStatus === 'online' ? 'bg-green-500 text-green-100' :
                  systemStatus === 'warning' ? 'bg-yellow-500 text-yellow-100' :
                  'bg-red-500 text-red-100'
                }`}
              >
                {systemStatus === 'online' ? 'ONLINE' : 
                  systemStatus === 'warning' ? 'WARNING' : 'ERROR'}
              </span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {logSource && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs uppercase">
                {logSource}
              </span>
            )}
            
            <span className={`text-${darkMode ? 'slate-400' : 'gray-500'} text-sm`}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
            
            {/* Tool buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullScreen}
                className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-white hover:bg-gray-100 border border-gray-300'} transition`}
                title={isFullScreen ? "Exit Full Screen" : "Full Screen Mode"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-white hover:bg-gray-100 border border-gray-300'} transition`}
                title={darkMode ? "Light Mode" : "Dark Mode"}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              
              <button
                onClick={cycleFontSize}
                className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-white hover:bg-gray-100 border border-gray-300'} transition`}
                title="Change Font Size"
              >
                <Type className="w-4 h-4" />
              </button>
              
              <select
                value={refreshInterval || ''}
                onChange={(e) => setRefreshInterval(e.target.value ? parseInt(e.target.value) : null)}
                className={`p-2 rounded-lg ${darkMode ? 'bg-slate-700 text-white border-slate-600' : 'bg-white text-gray-900 border-gray-300'} border`}
              >
                <option value="">Manual Refresh</option>
                <option value="15">Refresh: 15s</option>
                <option value="30">Refresh: 30s</option>
                <option value="60">Refresh: 1m</option>
                <option value="300">Refresh: 5m</option>
              </select>
              
              <button
                onClick={() => {
                  setLastUpdated(new Date());
                  window.location.reload();
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 transition flex items-center gap-2 text-sm rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
        
        {/* Real-time Status Section */}
        <div className={`mb-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'} rounded-xl border`}>
          <div 
            className="p-4 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('status')}
          >
            <h2 className="text-lg font-semibold flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-400" />
              Real-time System Status
            </h2>
            {expandedSections.status ? (
              <ChevronUp className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
            )}
          </div>
          
          {expandedSections.status && (
            <div className={`p-4 pt-0 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className={`${darkMode ? 'bg-blue-900/20' : 'bg-blue-50 border border-blue-100'} rounded-lg p-4`}>
                  <div className={`flex items-center gap-2 ${darkMode ? 'text-blue-400' : 'text-blue-700'} mb-2`}>
                    <Camera className="w-4 h-4" />
                    <span className="text-sm font-medium">X-rays Taken</span>
                  </div>
                  <div className="text-2xl font-bold">{systemMetrics.xrayCount}</div>
                  <div className={`text-xs ${darkMode ? 'text-blue-300/70' : 'text-blue-500'} mt-1`}>
                    Valid Panoramic X-rays
                  </div>
                </div>
                
                <div className={`${darkMode ? 'bg-purple-900/20' : 'bg-purple-50 border border-purple-100'} rounded-lg p-4`}>
                  <div className={`flex items-center gap-2 ${darkMode ? 'text-purple-400' : 'text-purple-700'} mb-2`}>
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Active Patients</span>
                  </div>
                  <div className="text-2xl font-bold">{systemMetrics.patientCount}</div>
                  <div className={`text-xs ${darkMode ? 'text-purple-300/70' : 'text-purple-500'} mt-1`}>
                    Unique patients
                  </div>
                </div>
                
                <div className={`${darkMode ? 'bg-green-900/20' : 'bg-green-50 border border-green-100'} rounded-lg p-4`}>
                  <div className={`flex items-center gap-2 ${darkMode ? 'text-green-400' : 'text-green-700'} mb-2`}>
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Success Rate</span>
                  </div>
                  <div className="text-2xl font-bold">{systemMetrics.successRate.toFixed(1)}%</div>
                  <div className={`text-xs ${darkMode ? 'text-green-300/70' : 'text-green-500'} mt-1`}>
                    X-ray processing rate
                  </div>
                </div>
                
                <div className={`${darkMode ? 'bg-amber-900/20' : 'bg-amber-50 border border-amber-100'} rounded-lg p-4`}>
                  <div className={`flex items-center gap-2 ${darkMode ? 'text-amber-400' : 'text-amber-700'} mb-2`}>
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Processing Time</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {systemMetrics.avgProcessingTime.toFixed(1)}s
                  </div>
                  <div className={`text-xs ${darkMode ? 'text-amber-300/70' : 'text-amber-500'} mt-1`}>
                    Average per X-ray
                  </div>
                </div>
              </div>
              
              {/* System Info Overview */}
              <div className={`${darkMode ? 'bg-slate-700/50' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4 mb-4`}>
                <h3 className={`${darkMode ? 'text-blue-400' : 'text-blue-700'} font-medium mb-3 flex items-center`}>
                  <Server className="w-4 h-4 mr-2" />
                  System Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`${darkMode ? 'bg-slate-800' : 'bg-white border border-gray-200'} rounded-lg p-3`}>
                    <h4 className={`${darkMode ? 'text-blue-400' : 'text-blue-700'} font-medium mb-2 text-sm`}>Software</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>Name:</span>
                        <span className={`${darkMode ? 'text-white' : 'text-gray-900'} font-medium text-sm`}>
                          {xrayConfig?.name || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>Version:</span>
                        <span className={`${darkMode ? 'text-white' : 'text-gray-900'} font-medium text-sm`}>
                          {xrayConfig?.version || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>Status:</span>
                        <span className={`font-medium text-sm ${
                          systemStatus === 'online' ? darkMode ? 'text-green-400' : 'text-green-600' :
                          systemStatus === 'warning' ? darkMode ? 'text-yellow-400' : 'text-yellow-600' :
                          darkMode ? 'text-red-400' : 'text-red-600'
                        }`}>
                          {systemStatus === 'online' ? 'Operational' : 
                           systemStatus === 'warning' ? 'Degraded' : 'Error'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`${darkMode ? 'bg-slate-800' : 'bg-white border border-gray-200'} rounded-lg p-3`}>
                    <h4 className={`${darkMode ? 'text-purple-400' : 'text-purple-700'} font-medium mb-2 text-sm`}>Database</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>Server:</span>
                        <span className={`${darkMode ? 'text-white' : 'text-gray-900'} font-medium text-sm`}>
                          {xrayConfig?.dbConfig?.server || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>Database:</span>
                        <span className={`${darkMode ? 'text-white' : 'text-gray-900'} font-medium text-sm`}>
                          {xrayConfig?.dbConfig?.database || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>SSL:</span>
                        <span className={`${darkMode ? 'text-white' : 'text-gray-900'} font-medium text-sm`}>
                          {xrayConfig?.dbConfig?.ssl ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`${darkMode ? 'bg-slate-800' : 'bg-white border border-gray-200'} rounded-lg p-3`}>
                    <h4 className={`${darkMode ? 'text-amber-400' : 'text-amber-700'} font-medium mb-2 text-sm`}>Activity</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>Errors:</span>
                        <span className={`${darkMode ? 'text-red-400' : 'text-red-600'} font-medium text-sm`}>
                          {systemMetrics.errorCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>Warnings:</span>
                        <span className={`${darkMode ? 'text-yellow-400' : 'text-yellow-600'} font-medium text-sm`}>
                          {systemMetrics.warningCount}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`${darkMode ? 'text-slate-400' : 'text-gray-500'} text-sm`}>Last X-ray:</span>
                        <span className={`${darkMode ? 'text-blue-400' : 'text-blue-600'} font-medium text-sm`}>
                          {treatments.length > 0 
                            ? new Date(treatments[0].timestamp).toLocaleTimeString()
                            : 'N/A'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Hourly Distribution */}
              <div className={`${darkMode ? 'bg-slate-700/50' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4`}>
                <h3 className={`${darkMode ? 'text-blue-400' : 'text-blue-700'} font-medium mb-3`}>
                  Hourly Activity Distribution
                </h3>
                
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={getActivityData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#444" : "#eee"} />
                      <XAxis 
                        dataKey="hour" 
                        stroke={darkMode ? "#999" : "#666"}
                      />
                      <YAxis 
                        stroke={darkMode ? "#999" : "#666"}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: darkMode ? '#1e293b' : '#fff', 
                          border: darkMode ? '1px solid #334155' : '1px solid #ddd',
                          borderRadius: '0.375rem'
                        }}
                      />
                      <Legend />
                      <Bar 
                        dataKey="xrays" 
                        name="X-rays Taken" 
                        fill="#3b82f6" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* System Health Section */}
        <div className={`mb-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'} rounded-xl border`}>
          <div 
            className="p-4 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('health')}
          >
            <h2 className="text-lg font-semibold flex items-center">
              <Heart className="w-5 h-5 mr-2 text-pink-500" />
              System Health
            </h2>
            {expandedSections.health ? (
              <ChevronUp className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
            )}
          </div>
          
          {expandedSections.health && (
            <div className={`p-4 pt-0 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              {/* Health Score Radar Chart */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className={`col-span-1 ${darkMode ? 'bg-slate-700/50' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4`}>
                  <h3 className={`${darkMode ? 'text-blue-400' : 'text-blue-700'} font-medium mb-3`}>Health Scores</h3>
                  
                  <div className="space-y-3">
                    {healthScores.map((category) => (
                      <div key={category.category}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm">{category.category}</span>
                          <span className={`text-sm ${
                            category.score >= 90 ? darkMode ? 'text-green-400' : 'text-green-600' :
                            category.score >= 70 ? darkMode ? 'text-blue-400' : 'text-blue-600' :
                            category.score >= 50 ? darkMode ? 'text-yellow-400' : 'text-yellow-600' :
                            darkMode ? 'text-red-400' : 'text-red-600'
                          }`}>
                            {category.score >= 90 ? 'Excellent' :
                             category.score >= 70 ? 'Good' :
                             category.score >= 50 ? 'Fair' : 'Poor'}
                          </span>
                        </div>
                        <div className={`w-full ${darkMode ? 'bg-slate-600' : 'bg-gray-300'} rounded-full h-2.5`}>
                          <div 
                            className={`h-2.5 rounded-full ${
                              category.score >= 90 ? 'bg-green-500' :
                              category.score >= 70 ? 'bg-blue-500' :
                              category.score >= 50 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${category.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className={`col-span-2 ${darkMode ? 'bg-slate-700/50' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4`}>
                  <h3 className={`${darkMode ? 'text-blue-400' : 'text-blue-700'} font-medium mb-3`}>Health Radar</h3>
                  
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart outerRadius={90} data={healthScores}>
                        <PolarGrid stroke={darkMode ? "#444" : "#ccc"} />
                        <PolarAngleAxis 
                          dataKey="category" 
                          tick={{ fill: darkMode ? '#fff' : '#333' }}
                        />
                        <PolarRadiusAxis 
                          angle={30} 
                          domain={[0, 100]} 
                          tick={{ fill: darkMode ? '#aaa' : '#666' }}
                        />
                        <Radar 
                          name="Health Score" 
                          dataKey="score" 
                          stroke="#3b82f6" 
                          fill="#3b82f6" 
                          fillOpacity={0.6} 
                        />
                        <Tooltip 
                          formatter={(value) => [`${value}%`, 'Health Score']}
                          contentStyle={{ 
                            backgroundColor: darkMode ? '#1e293b' : '#fff', 
                            border: darkMode ? '1px solid #334155' : '1px solid #ddd'
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              {/* Error Time Distribution */}
              <div className={`${darkMode ? 'bg-slate-700/50' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4`}>
                <h3 className={`${darkMode ? 'text-red-400' : 'text-red-700'} font-medium mb-3`}>Error Time Distribution</h3>
                
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={getErrorDistribution}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#444" : "#eee"} />
                      <XAxis 
                        dataKey="hour" 
                        stroke={darkMode ? "#999" : "#666"}
                      />
                      <YAxis 
                        stroke={darkMode ? "#999" : "#666"}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: darkMode ? '#1e293b' : '#fff', 
                          border: darkMode ? '1px solid #334155' : '1px solid #ddd',
                          borderRadius: '0.375rem'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="errors" 
                        stroke="#ef4444" 
                        fill="#ef4444" 
                        fillOpacity={0.2}
                        activeDot={{ r: 6 }}
                        name="Error Count"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Activity Timeline Section */}
        <div className={`mb-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'} rounded-xl border`}>
          <div 
            className="p-4 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('activity')}
          >
            <h2 className="text-lg font-semibold flex items-center">
              <Radio className="w-5 h-5 mr-2 text-green-500" />
              X-ray Activity Timeline
            </h2>
            {expandedSections.activity ? (
              <ChevronUp className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
            )}
          </div>
          
          {expandedSections.activity && (
            <div className={`p-4 pt-0 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              {/* Recent Activity List */}
              <div className={`${darkMode ? 'bg-slate-700/50' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4 mb-4`}>
                <h3 className={`${darkMode ? 'text-blue-400' : 'text-blue-700'} font-medium mb-3`}>
                  Recent X-ray Activity
                </h3>
                
                {treatments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`text-left ${darkMode ? 'border-b border-slate-600' : 'border-b border-gray-300'}`}>
                          <th className={`pb-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'} font-medium`}>Timestamp</th>
                          <th className={`pb-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'} font-medium`}>Patient</th>
                          <th className={`pb-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'} font-medium`}>Type</th>
                          <th className={`pb-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'} font-medium`}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {treatments.slice(0, 10).map((treatment, index) => (
                          <tr key={index} className={darkMode ? 'border-b border-slate-700 hover:bg-slate-700/30' : 'border-b border-gray-200 hover:bg-gray-50'}>
                            <td className="py-2">{formatTimestamp(treatment.timestamp)}</td>
                            <td className="py-2">{treatment.patientName}</td>
                            <td className="py-2">
                              <span className={`px-2 py-0.5 ${darkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-800'} rounded-full text-xs`}>
                                {treatment.type}
                              </span>
                            </td>
                            <td className="py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                treatment.success 
                                  ? darkMode ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-800'
                                  : darkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-800'
                              }`}>
                                {treatment.success ? 'Success' : 'Failed'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`text-center py-4 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                    No treatments found
                  </div>
                )}
              </div>
              
              {/* Activity Patterns */}
              <div className={`${darkMode ? 'bg-slate-700/50' : 'bg-gray-50 border border-gray-200'} rounded-lg p-4`}>
                <h3 className={`${darkMode ? 'text-blue-400' : 'text-blue-700'} font-medium mb-3`}>
                  Patient Activity Pattern
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                      Hourly Distribution
                    </h4>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                          data={getActivityData}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#444" : "#eee"} />
                          <XAxis dataKey="hour" stroke={darkMode ? "#999" : "#666"} />
                          <YAxis stroke={darkMode ? "#999" : "#666"} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: darkMode ? '#1e293b' : '#fff', 
                              border: darkMode ? '1px solid #334155' : '1px solid #ddd',
                              borderRadius: '0.375rem'
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="xrays" 
                            name="X-rays" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className={`text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                      Status Distribution
                    </h4>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Success', value: treatments.filter(t => t.success).length },
                              { name: 'Failed', value: treatments.filter(t => !t.success).length }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: darkMode ? '#1e293b' : '#fff', 
                              border: darkMode ? '1px solid #334155' : '1px solid #ddd',
                              borderRadius: '0.375rem'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Active Alerts Section */}
        <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-300'} rounded-xl border`}>
          <div 
            className="p-4 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('alerts')}
          >
            <h2 className="text-lg font-semibold flex items-center">
              <Bell className="w-5 h-5 mr-2 text-amber-500" />
              Active Alerts
              <span className={`ml-2 w-5 h-5 flex items-center justify-center rounded-full text-xs ${
                alerts.length > 0 
                  ? darkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600'
                  : darkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
              }`}>
                {alerts.length}
              </span>
            </h2>
            {expandedSections.alerts ? (
              <ChevronUp className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
            ) : (
              <ChevronDown className={`w-5 h-5 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`} />
            )}
          </div>
          
          {expandedSections.alerts && (
            <div className={`p-4 pt-0 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`p-3 rounded-lg ${
                        alert.severity === 'error' 
                          ? darkMode ? 'bg-red-900/20 border border-red-600/30' : 'bg-red-50 border border-red-200'
                          : darkMode ? 'bg-amber-900/20 border border-amber-600/30' : 'bg-amber-50 border border-amber-200'
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="mr-3 mt-1">
                          {alert.severity === 'error' ? (
                            <AlertCircle className={`w-5 h-5 ${darkMode ? 'text-red-500' : 'text-red-600'}`} />
                          ) : (
                            <AlertTriangle className={`w-5 h-5 ${darkMode ? 'text-amber-500' : 'text-amber-600'}`} />
                          )}
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between items-center mb-1">
                            <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                              {formatTimestamp(alert.timestamp)}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              alert.severity === 'error' 
                                ? darkMode ? 'bg-red-900/40 text-red-400' : 'bg-red-100 text-red-700'
                                : darkMode ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {alert.severity.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm">
                            {alert.message}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`${darkMode ? 'bg-green-900/20' : 'bg-green-50'} p-4 rounded-lg border ${darkMode ? 'border-green-700/30' : 'border-green-200'} text-center`}>
                  <CheckCircle className={`w-10 h-10 mx-auto mb-2 ${darkMode ? 'text-green-500' : 'text-green-600'}`} />
                  <p className={`font-medium ${darkMode ? 'text-green-400' : 'text-green-800'}`}>
                    No active alerts
                  </p>
                  <p className={`text-sm mt-1 ${darkMode ? 'text-green-500/70' : 'text-green-600'}`}>
                    All systems operating normally
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer with auto-refresh indicator */}
        <div className="mt-6 text-center">
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            System monitoring {refreshInterval 
              ? `- Auto-refreshing every ${refreshInterval} seconds` 
              : '- Manual refresh mode'}
          </p>
          <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

// Add this CSS to your global CSS or inline styles
const globalStyles = `
@keyframes progress-indeterminate {
  0% { transform: translateX(-100%) }
  50% { transform: translateX(0%) }
  100% { transform: translateX(100%) }
}

.animate-progress-indeterminate {
  animation: progress-indeterminate 2s ease-in-out infinite;
}
`;

export default DentalXrayMonitoring;