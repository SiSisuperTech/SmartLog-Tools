import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { 
  ChevronLeft, 
  ChevronRight,
  Search, 
  AlertCircle, 
  RefreshCw,
  Download,
  FileText,
  AlertTriangle,
  X,
  Calendar,
  Camera,
  Database,
  Settings,
  Server,
  Users,
  HardDrive,
  Activity,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Bell,
  Monitor,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Type,
  Wrench,
  Filter,
  Clock,
  Workflow,
  Radio,
  Trash2,
  BarChart3,
  FileDown,
  Info,
  ClipboardCopy,
  ListFilter,
  MoreHorizontal,
  BookOpen,
  Code,
  Copy,
  PanelLeft,
  Check
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
  Area
} from 'recharts';

import { format, parseISO, differenceInDays } from 'date-fns';

// Interface definitions
interface LogEntry {
  timestamp: string;
  message: string;
  logStream?: string;
  severity: 'info' | 'warning' | 'error';
  id?: string;
}

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
}

// Constants
const DATE_PRESETS = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 24 Hours', value: '24h' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' }
];

const LOGS_PER_PAGE_OPTIONS = [25, 50, 100, 250, 500];

// Chart colors
const CHART_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#10b981', // Green
  '#ec4899', // Pink
  '#6366f1', // Indigo
  '#14b8a6'  // Teal
];

// Update imports to include LoadingPage
import LoadingPage from '../components/LoadingPage';

/**
 * Log Analysis Page Component
 * Shows detailed log analysis and x-ray monitoring data
 */
const LogAnalysisPage: React.FC = () => {
  // Navigation
  const navigate = useNavigate();
  const fullscreenRef = useRef<HTMLDivElement>(null);
  
  // Core state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logSource, setLogSource] = useState<'aws' | 'manual' | 'query' | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(100);
  
  // Calculate pagination (placed here to fix TypeScript errors)
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * logsPerPage;
    return filteredLogs.slice(startIndex, startIndex + logsPerPage);
  }, [filteredLogs, currentPage, logsPerPage]);

  const totalPages = useMemo(() => 
    Math.ceil(filteredLogs.length / logsPerPage)
  , [filteredLogs, logsPerPage]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [selectedLogStreams, setSelectedLogStreams] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('all');
  
  // Analysis and metrics
  const [panoCount, setPanoCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [xrayConfig, setXrayConfig] = useState<XrayConfig | null>(null);
  const [treatments, setTreatments] = useState<TreatmentInfo[]>([]);
  const [dailyStats, setDailyStats] = useState<{date: string, panos: number, errors: number}[]>([]);
  const [systemStatus, setSystemStatus] = useState<'online' | 'offline' | 'warning' | 'error'>('online');
  
  // UI state
  const [expandedSections, setExpandedSections] = useState({
    config: true,
    overview: true,
    logs: true
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState('normal'); // 'small', 'normal', 'large'
  const [darkMode, setDarkMode] = useState(true);
  
  // Enhanced log viewer state
  const [logView, setLogView] = useState<'basic' | 'detailed'>('basic');
  const [highlightText, setHighlightText] = useState('');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [isSearchingInLogs, setIsSearchingInLogs] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [viewJsonMode, setViewJsonMode] = useState(false);
  const [visiblePanel, setVisiblePanel] = useState<'none' | 'filter' | 'details'>('none');
  
  // ===== Utility Functions =====
  
  // Parse timestamp with robust error handling
  const parseTimestamp = useCallback((timestamp: string): Date | null => {
    if (!timestamp) return null;
    
    try {
      // Handle various timestamp formats
      let isoTimestamp = timestamp;
      if (typeof timestamp === 'string' && timestamp.includes(' ')) {
        isoTimestamp = timestamp.replace(' ', 'T') + 'Z';
      }
      
      // Try parsing as ISO string
      const date = new Date(isoTimestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Try as numeric timestamp
      if (/^\d+$/.test(String(timestamp))) {
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

  // Format timestamp for display
  const formatTimestamp = useCallback((timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
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

  // Cycle through font sizes
  const cycleFontSize = useCallback(() => {
    setFontSize(prev => {
      if (prev === 'small') return 'normal';
      if (prev === 'normal') return 'large';
      return 'small';
    });
  }, []);

  // Get CSS class for current font size
  const getFontSizeClass = useCallback(() => {
    switch (fontSize) {
      case 'small': return 'text-xs';
      case 'large': return 'text-lg';
      default: return 'text-sm';
    }
  }, [fontSize]);

  // Clear all logs with improved functionality
  const clearAllLogs = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      // Clear logs from state
      setLogs([]);
      setFilteredLogs([]);
      
      // Clear related state
      setTreatments([]);
      setPanoCount(0);
      setErrorCount(0);
      setWarningCount(0);
      setSystemStatus('online');
      setXrayConfig(null);
      setDailyStats([]);
      
      // Clear session storage thoroughly
      Object.keys(sessionStorage).forEach(key => {
        if (key.includes('Log') || key.includes('log') || key === 'logSource') {
          sessionStorage.removeItem(key);
        }
      });
      
      // Set log source to null
      setLogSource(null);
      
      // Show confirmation
      alert('All logs have been cleared successfully.');
    }
  }, []);

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
  
  // Process log messages with enhanced formatting
  const processLogMessage = useCallback((message: string, severity: string): string => {
    let processedMessage = message;
    
    // Process configuration objects
    if (message.includes('Configuration loaded') || message.includes('checked configuration')) {
      const configStart = message.indexOf('{');
      if (configStart !== -1) {
        try {
          const configObj = JSON.parse(message.slice(configStart));
          const formattedConfig = JSON.stringify(configObj, null, 2);
          processedMessage = `${message.slice(0, configStart)}<div class="bg-slate-800 p-2 rounded mt-1 text-xs overflow-x-auto whitespace-pre">${formattedConfig}</div>`;
        } catch (e) {
          // Keep original on parsing error
        }
      }
    }
    
    // Highlight treatment creations
    else if (message.includes('createTreatment') || message.includes('Treatment created')) {
      processedMessage = `<div class="flex items-center gap-1">
        <svg class="w-3 h-3 text-blue-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><path d="M16.5 7.5v.001"/></svg>
        <span>${message}</span>
      </div>`;
    }
    
    // Highlight database operations
    else if (message.includes('database') || message.includes('query') || message.includes('SQL')) {
      processedMessage = `<div class="flex items-center gap-1">
        <svg class="w-3 h-3 text-purple-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        <span>${message}</span>
      </div>`;
    }
    
    // Highlight network/connection messages
    else if (message.includes('network') || message.includes('connection') || message.includes('socket')) {
      processedMessage = `<div class="flex items-center gap-1">
        <svg class="w-3 h-3 text-green-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m2 2 20 20"/></svg>
        <span>${message}</span>
      </div>`;
    }
    
    // Highlight errors with error keywords
    else if (severity === 'error') {
      // Highlight common error keywords
      const errorKeywords = ['exception', 'failed', 'timeout', 'cannot', 'unable', 'invalid', 'error'];
      for (const keyword of errorKeywords) {
        const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
        processedMessage = processedMessage.replace(
          regex, 
          '<span class="text-red-400 font-semibold">$1</span>'
        );
      }
    }
    
    return processedMessage;
  }, []);

  // Search within displayed logs
  const searchInLogs = useCallback((searchText: string) => {
    if (!searchText) {
      setSearchResults([]);
      setCurrentSearchIndex(0);
      return;
    }
    
    const results = paginatedLogs.reduce<number[]>((acc, log, index) => {
      if (log.message.toLowerCase().includes(searchText.toLowerCase())) {
        acc.push(index);
      }
      return acc;
    }, []);
    
    setSearchResults(results);
    setCurrentSearchIndex(0);
    
    // Scroll to first result if found
    if (results.length > 0) {
      setTimeout(() => {
        const logElement = document.getElementById(`log-${results[0]}`);
        if (logElement) {
          logElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [paginatedLogs]);
  
  // ===== Data Processing Functions =====
  
  // Extract system information from logs with improved X-ray deduplication
  const extractSystemInfo = useCallback((logEntries: LogEntry[]) => {
    // Extract X-ray configuration
    const configLog = logEntries.find(log => 
      log.message.includes('Configuration loaded') || 
      log.message.includes('checked configuration')
    );
    
    if (configLog) {
      try {
        const configStart = configLog.message.indexOf('{');
        if (configStart !== -1) {
          const configData = JSON.parse(configLog.message.slice(configStart));
          
          // Create standardized XrayConfig object
          const xrayConfigObj: XrayConfig = {
            name: configData.storeXraySoftware?.name || 'Unknown',
            version: configData.storeXraySoftware?.version || 'Unknown',
            pmBridgePath: configData.conf?.pmBridgePath || 'Unknown',
            isValid: configData.isConfigurationValid === true
          };
          
          // Add database config if available
          if (configData.conf?.dbConfig) {
            xrayConfigObj.dbConfig = configData.conf.dbConfig;
          }
          
          // Add software-specific paths and configurations
          if (configData.conf?.romexisRadioPath) {
            xrayConfigObj.romexisRadioPath = configData.conf.romexisRadioPath;
          }
          
          if (configData.conf?.vatechDbFolderPath) {
            xrayConfigObj.vatechDbFolderPath = configData.conf.vatechDbFolderPath;
          }
          
          if (configData.conf?.carestreamRadioPath) {
            xrayConfigObj.carestreamRadioPath = configData.conf.carestreamRadioPath;
          }
          
          if (configData.conf?.isFormattedPatientIdMode !== undefined) {
            xrayConfigObj.isFormattedPatientIdMode = configData.conf.isFormattedPatientIdMode;
          }
          
          setXrayConfig(xrayConfigObj);
        }
      } catch (error) {
        console.error('Error parsing configuration:', error);
      }
    }
    
    // Extract treatments (panoramic X-rays) with deduplication
    const treatmentLogs = logEntries.filter(log => 
      log.message.includes('createTreatment') || log.message.includes('Treatment created')
    );

    // First extract all potential treatments
    const extractedTreatmentsCandidates = treatmentLogs
      .filter(log => {
        // Look for a pattern after "for" that includes any masked information (contains asterisks)
        const patientNameRegex = /for\s+([\w\s*]+)/i;
        const messageMatch = log.message.match(patientNameRegex);
        
        // Consider valid if the name contains asterisks (masked information)
        return messageMatch && messageMatch[1].includes('*');
      })
      .map((log, index) => {
        // Extract patient name using the same regex for consistency
        const patientNameRegex = /for\s+([\w\s*]+)/i;
        const messageMatch = log.message.match(patientNameRegex);
        const patientName = messageMatch ? messageMatch[1].trim() : 'Unknown Patient';
        
        return {
          timestamp: log.timestamp,
          date: new Date(log.timestamp), // Store the actual date object for comparison
          patientId: `treatment-${index}`,
          patientName,
          type: 'Panoramic X-ray',
          logIndex: index // Store the original index for reference
        };
      })
      // Sort by patient name then timestamp to group related entries
      .sort((a, b) => {
        // First sort by patient name
        const nameCompare = a.patientName.localeCompare(b.patientName);
        if (nameCompare !== 0) return nameCompare;
        
        // If same name, sort by timestamp
        return a.date.getTime() - b.date.getTime();
      });

    // Deduplicate by patient name and time proximity
    const extractedTreatments = [];
    const TIME_THRESHOLD = 60 * 1000; // 60 seconds in milliseconds

    for (let i = 0; i < extractedTreatmentsCandidates.length; i++) {
      const current = extractedTreatmentsCandidates[i];
      
      // Always include the first entry
      if (i === 0) {
        extractedTreatments.push(current);
        continue;
      }
      
      // Get the previous entry (most recent one we've processed)
      const previous = extractedTreatmentsCandidates[i-1];
      
      // If different patient name, it's a new unique treatment
      if (current.patientName !== previous.patientName) {
        extractedTreatments.push(current);
        continue;
      }
      
      // If same patient name but timestamp is far enough apart, it's a new treatment
      const timeDiff = Math.abs(current.date.getTime() - previous.date.getTime());
      if (timeDiff > TIME_THRESHOLD) {
        extractedTreatments.push(current);
      }
      // Otherwise, it's a duplicate and we skip it
    }

    // Sort final results by timestamp (newest first) for display
    extractedTreatments.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Remove the temporary date object before setting state
    const finalTreatments = extractedTreatments.map(({ date, logIndex, ...rest }) => rest);

    setTreatments(finalTreatments);
    setPanoCount(finalTreatments.length);
    
    // Count errors and warnings
    const errors = logEntries.filter(log => log.severity === 'error');
    const warnings = logEntries.filter(log => log.severity === 'warning');
    setErrorCount(errors.length);
    setWarningCount(warnings.length);
    
    // Set system status based on errors/warnings
    if (errors.length > 0) {
      setSystemStatus('error');
    } else if (warnings.length > 0) {
      setSystemStatus('warning');
    } else {
      setSystemStatus('online');
    }
    
    // Generate daily stats with proper deduplication
    const today = new Date();
    const dailyStatsMap: Record<string, {panos: number, errors: number}> = {};
    
    // Initialize the last 7 days with proper dates
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      const dateKey = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      dailyStatsMap[dateKey] = { panos: 0, errors: 0 };
    }
    
    // First collect all potential x-ray events grouped by day and patient
    const xraysByDayAndPatient: Record<string, Record<string, Array<Date>>> = {};
    
    // Process logs to identify potential x-ray events
    logEntries.forEach(log => {
      try {
        const timestamp = log.timestamp;
        const date = new Date(timestamp);
        
        // Skip invalid dates
        if (isNaN(date.getTime())) return;
        
        const dateKey = date.toISOString().split('T')[0];
        
        // Only process logs from the last 7 days
        if (dailyStatsMap[dateKey]) {
          // Count errors (no deduplication needed for errors)
          if (log.severity === 'error') {
            dailyStatsMap[dateKey].errors++;
          }
          
          // Process potential x-rays
          if (log.message.includes('createTreatment') || log.message.includes('Treatment created')) {
            const patientNameRegex = /for\s+([\w\s*]+)/i;
            const messageMatch = log.message.match(patientNameRegex);
            
            if (messageMatch && messageMatch[1].includes('*')) {
              const patientName = messageMatch[1].trim();
              
              // Initialize the mapping structures if needed
              if (!xraysByDayAndPatient[dateKey]) {
                xraysByDayAndPatient[dateKey] = {};
              }
              
              if (!xraysByDayAndPatient[dateKey][patientName]) {
                xraysByDayAndPatient[dateKey][patientName] = [];
              }
              
              // Add this timestamp to the patient's timestamps for this day
              xraysByDayAndPatient[dateKey][patientName].push(date);
            }
          }
        }
      } catch (e) {
        // Skip problematic entries
        console.error('Error processing log for activity chart:', e);
      }
    });
    
    // Now process the collected x-ray events with deduplication
    // For each day
    Object.keys(xraysByDayAndPatient).forEach(dateKey => {
      const patientMap = xraysByDayAndPatient[dateKey];
      
      // For each patient on this day
      Object.keys(patientMap).forEach(patientName => {
        const timestamps = patientMap[patientName];
        
        // Sort timestamps chronologically
        timestamps.sort((a, b) => a.getTime() - b.getTime());
        
        // Count unique x-rays (separated by at least TIME_THRESHOLD)
        let uniqueXrays = 0;
        let lastTimestamp: Date | null = null;
        
        timestamps.forEach(timestamp => {
          if (!lastTimestamp || Math.abs(timestamp.getTime() - lastTimestamp.getTime()) > TIME_THRESHOLD) {
            uniqueXrays++;
            lastTimestamp = timestamp;
          }
          // Else it's too close to the previous - consider it a duplicate
        });
        
        // Add the unique count to the day's total
        dailyStatsMap[dateKey].panos += uniqueXrays;
      });
    });
    
    // Convert to array format for charts
    const dailyStatsArray = Object.entries(dailyStatsMap).map(([date, stats]) => ({
      date,
      panos: stats.panos,
      errors: stats.errors
    }));
    
    // Sort by date ascending
    dailyStatsArray.sort((a, b) => a.date.localeCompare(b.date));
    
    setDailyStats(dailyStatsArray);
  }, []);

  // Export logs function
  const exportLogs = useCallback(() => {
    const filename = `log-export-${format(new Date(), 'yyyy-MM-dd-HH-mm')}`;
    
    // Create a nicely formatted text output for better readability
    const header = "====== DENTAL X-RAY SYSTEM LOG EXPORT ======\n";
    const timestamp = `Export Date: ${format(new Date(), 'MMMM d, yyyy HH:mm:ss')}\n`;
    const summary = `Total Logs: ${logs.length}\nFiltered Logs: ${filteredLogs.length}\n`;
    const divider = "===========================================\n\n";
    
    const logEntries = filteredLogs.map(log => 
      `[${formatTimestamp(log.timestamp)}] [${log.severity.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    const dataStr = header + timestamp + summary + divider + logEntries;
    
    const blob = new Blob([dataStr], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredLogs, formatTimestamp, logs.length]);
  
  // ===== Effects =====
  
  // Load logs on component mount
  useEffect(() => {
    const loadLogs = async () => {
      // Check if we should show the loading page (set by ClinicMonitoringDashboard)
      const shouldShowLoading = sessionStorage.getItem('showLoading') === 'true';
      
      if (shouldShowLoading) {
        setIsLoading(true);
        // Clear the flag so it doesn't persist between navigations
        sessionStorage.removeItem('showLoading');
      }
      
      setError(null);
      
      try {
        // Check for location ID in URL parameters
        const queryParams = new URLSearchParams(window.location.search);
        const locationId = queryParams.get('locationId');
        console.log(`LogAnalysisPage initialized with locationId: ${locationId || 'null'}`);
        
        // Check for source in session storage
        const source = sessionStorage.getItem('logSource');
        if (!source) {
          setLogs([]);
          setFilteredLogs([]);
          setIsLoading(false);
          return;
        }
        
        let storedLogs: LogEntry[] = [];
        
        // Check if we're coming from ClinicMonitoringDashboard with a parameter
        if (locationId) {
          const allLogs = await fetchAllLogsFromSessionStorage(source);
          
          if (allLogs.length > 0) {
            // Filter logs by locationId
            storedLogs = allLogs.filter(log => 
              log.logStream?.includes(`[${locationId}]`)
            );
            
            console.log(`Found ${storedLogs.length} logs for locationId: ${locationId}`);
          }
        } else {
          // Load logs normally if no locationId provided
          storedLogs = await fetchAllLogsFromSessionStorage(source);
        }
        
        // Process and set logs
        const validatedLogs = storedLogs.map(log => ({
          ...log,
          message: log.message || 'No content available',
          severity: log.severity || 'info' // Ensure severity exists
        }));
        
        // Sort by timestamp (newest first)
        validatedLogs.sort((a: LogEntry, b: LogEntry) => {
          const dateA = parseTimestamp(a.timestamp) || new Date(0);
          const dateB = parseTimestamp(b.timestamp) || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        
        setLogSource(source as 'aws' | 'manual' | 'query' | null);
        setLogs(validatedLogs);
        setFilteredLogs(validatedLogs);
        
        if (validatedLogs.length > 0) {
          extractSystemInfo(validatedLogs);
          console.log(`Loaded ${validatedLogs.length} logs from ${source} source${locationId ? ` for locationId: ${locationId}` : ''}`);
        } else {
          console.warn(`No logs found from ${source} source${locationId ? ` for locationId: ${locationId}` : ''}`);
        }
      } catch (error) {
        console.error('Error loading logs:', error);
        setError(`Failed to load logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLogs([]);
        setFilteredLogs([]);
      } finally {
        // Use a slight delay to ensure loading animation is visible
        setTimeout(() => {
          setIsLoading(false);
        }, 1000);
      }
    };

    loadLogs();
  }, [extractSystemInfo, parseTimestamp]);
  
  // Helper function to fetch all logs from sessionStorage
  const fetchAllLogsFromSessionStorage = async (source: string): Promise<LogEntry[]> => {
    let allLogs: LogEntry[] = [];
    
    // Check if we have specific queryLogs from ClinicMonitoringDashboard
    if (source === 'query' && sessionStorage.getItem('queryLogs')) {
      try {
        const queryLogsStr = sessionStorage.getItem('queryLogs');
        if (queryLogsStr) {
          const queryLogs = JSON.parse(queryLogsStr);
          console.log(`Loaded ${queryLogs.length} logs from queryLogs in sessionStorage`);
          return normalizeLogTimestamps(queryLogs);
        }
      } catch (e) {
        console.error('Error processing queryLogs:', e);
      }
    }
    
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
            allLogs = allLogs.concat(chunk);
          } catch (e) {
            console.error(`Error parsing chunk ${i}:`, e);
          }
        }
      }
      
      console.log(`Loaded ${allLogs.length} logs from ${count} chunks`);
    } else {
      // Try different storage formats
      if (source === 'manual') {
        // Load manually uploaded logs
        const logStorage = sessionStorage.getItem('manualLogs');
        if (logStorage) {
          const parsed = JSON.parse(logStorage);
          const rawLogs = Array.isArray(parsed) ? parsed : [parsed];
          allLogs = normalizeLogTimestamps(rawLogs);
        }
      } 
      else if (source === 'query' || source === 'direct') {
        // Load query results - try both formats
        const queryResults = sessionStorage.getItem(`${source}Logs`);
        if (queryResults) {
          const parsed = JSON.parse(queryResults);
          // Handle different result formats
          if (Array.isArray(parsed)) {
            allLogs = normalizeLogTimestamps(parsed);
          } else if (parsed.results && Array.isArray(parsed.results)) {
            allLogs = normalizeLogTimestamps(parsed.results);
          } else {
            console.log('Unknown query results format:', parsed);
          }
        }
      }
      else if (source === 'aws') {
        // Load AWS logs
        const logStorage = sessionStorage.getItem('awsLogs');
        if (logStorage) {
          try {
            const parsed = JSON.parse(logStorage);
            
            // Handle direct array format (new format)
            if (Array.isArray(parsed)) {
              console.log('Found direct array format logs', parsed.length);
              allLogs = normalizeLogTimestamps(parsed);
            }
            // Handle wrapped results format (legacy format)
            else if (parsed.results && Array.isArray(parsed.results)) {
              console.log('Found results-wrapped logs', parsed.results.length);
              allLogs = normalizeLogTimestamps(parsed.results);
            } else {
              console.log('Unknown AWS logs format:', parsed);
            }
          } catch (e) {
            console.error('Error parsing AWS logs:', e);
          }
        }
      }
    }
    
    // If we still have no logs, check for any log-like data
    if (allLogs.length === 0) {
      console.log('No logs found, looking for alternatives...');
      
      // Try direct session storage items that might contain logs
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.includes('Logs') || key.includes('logs'))) {
          try {
            const data = sessionStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              let candidateLogs: any[] = [];
              
              if (Array.isArray(parsed)) {
                candidateLogs = parsed;
              } else if (parsed.results && Array.isArray(parsed.results)) {
                candidateLogs = parsed.results;
              } else if (parsed.logs && Array.isArray(parsed.logs)) {
                candidateLogs = parsed.logs;
              }
              
              // Check if these look like logs
              if (candidateLogs.length > 0 && 
                  (candidateLogs[0].timestamp || candidateLogs[0].time) && 
                  (candidateLogs[0].message || candidateLogs[0].msg)) {
                console.log(`Found potential logs in ${key}, count: ${candidateLogs.length}`);
                // Convert to our log format
                const convertedLogs = candidateLogs.map(l => ({
                  timestamp: l.timestamp || l.time || new Date().toISOString(),
                  message: l.message || l.msg || 'No message',
                  severity: l.severity || l.level || 'info',
                  logStream: l.logStream || l.stream || null
                }));
                allLogs = normalizeLogTimestamps(convertedLogs);
                break;
              }
            }
          } catch (e) {
            console.error(`Error parsing potential logs from ${key}:`, e);
          }
        }
      }
    }
    
    return allLogs;
  };

  // Extract unique log streams for filtering
  const logStreams = useMemo(() => {
    const streams = new Set<string>();
    logs.forEach(log => {
      if (log.logStream) {
        streams.add(log.logStream);
      }
    });
    return Array.from(streams);
  }, [logs]);

  // Apply filters to logs
  useEffect(() => {
    if (!logs.length) {
      setFilteredLogs([]);
      return;
    }
    
    let result = [...logs];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        (log.message && log.message.toLowerCase().includes(term)) || 
        (log.logStream && log.logStream.toLowerCase().includes(term))
      );
    }
    
    // Apply errors and warnings filters
    if (showErrorsOnly && showWarningsOnly) {
      result = result.filter(log => log.severity === 'error' || log.severity === 'warning');
    } else if (showErrorsOnly) {
      result = result.filter(log => log.severity === 'error');
    } else if (showWarningsOnly) {
      result = result.filter(log => log.severity === 'warning');
    }
    
    // Filter by time range
    if (timeRange !== 'all') {
      const now = new Date();
      let cutoffDate = now;
      
      switch (timeRange) {
        case '24h':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
      
      result = result.filter(log => {
        try {
          const logDate = new Date(log.timestamp);
          return logDate >= cutoffDate;
        } catch (e) {
          return true; // Keep logs with invalid dates
        }
      });
    }
    
    // Filter by log streams
    if (selectedLogStreams.length > 0) {
      result = result.filter(log => 
        log.logStream && selectedLogStreams.includes(log.logStream)
      );
    }
    
    // Remove duplicates if enabled
    if (removeDuplicates) {
      const seen = new Set();
      result = result.filter(log => {
        const key = `${log.message}-${log.logStream}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    
    setFilteredLogs(result);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [
    logs, 
    searchTerm, 
    showErrorsOnly,
    showWarningsOnly,
    removeDuplicates, 
    selectedLogStreams,
    timeRange
  ]);

  // ===== Component Rendering Logic =====
  
  // No logs found state
  if (!logs.length) {
    // Check if any log-related data is in session storage
    // This could mean we're in the process of loading logs
    const hasLogData = Object.keys(sessionStorage).some(key => 
      key.includes('Log') || key.includes('log')
    );
    
    if (hasLogData) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl text-white font-medium">Loading Logs...</h2>
            <p className="text-slate-400 mt-2">Log data detected but processing...</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="min-h-screen bg-slate-900 p-6 text-white flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-amber-400 mb-6" />
          <h2 className="text-2xl font-semibold mb-4">No Logs Found</h2>
          <p className="text-slate-300 mb-6">
            There are no logs available for analysis. Please upload logs or query a log source.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => navigate('/log-query')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Query Logs
            </button>
            <button
              onClick={() => navigate('/manual-upload')}
              className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition"
            >
              Upload Logs
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state with logo
  if (isLoading) {
    return <LoadingPage message="Loading Log Analysis..." />;
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

  return (
    <div 
      className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-gray-100'} ${isFullScreen ? 'p-0' : 'p-4 md:p-6'} ${darkMode ? 'text-white' : 'text-gray-900'} transition-all duration-300`}
      ref={fullscreenRef}
    >
      {/* Enhanced Loading Screen */}
      {isLoading && (
        <LoadingPage 
          message="Loading X-ray Monitoring Data" 
          showProgress={true}
          isLoading={isLoading}
          onComplete={() => {
            // Use a slight delay to ensure loading animation is visible
            setTimeout(() => {
              setIsLoading(false);
            }, 1000);
          }}
        />
      )}
      
      <div className={`${isFullScreen ? 'max-w-full' : 'max-w-6xl'} mx-auto`}>
        {/* Rest of the component */}
      </div>
    </div>
  );
};

export default LogAnalysisPage;