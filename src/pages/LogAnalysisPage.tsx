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
      setIsLoading(true);
      setError(null);
      
      try {
        const source = sessionStorage.getItem('logSource');
        if (!source) {
          setLogs([]);
          setFilteredLogs([]);
          setIsLoading(false);
          return;
        }
        
        // Check if logs are chunked
        const chunksCount = sessionStorage.getItem(`${source}Logs_chunks`);
        let storedLogs: LogEntry[] = [];
        
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
          // Try different storage formats
          if (source === 'manual') {
            // Load manually uploaded logs
            const logStorage = sessionStorage.getItem('manualLogs');
            if (logStorage) {
              const parsed = JSON.parse(logStorage);
              const rawLogs = Array.isArray(parsed) ? parsed : [parsed];
              storedLogs = normalizeLogTimestamps(rawLogs);
            }
          } 
          else if (source === 'query' || source === 'direct') {
            // Load query results - try both formats
            const queryResults = sessionStorage.getItem(`${source}Logs`);
            if (queryResults) {
              const parsed = JSON.parse(queryResults);
              // Handle different result formats
              if (Array.isArray(parsed)) {
                storedLogs = normalizeLogTimestamps(parsed);
              } else if (parsed.results && Array.isArray(parsed.results)) {
                storedLogs = normalizeLogTimestamps(parsed.results);
              } else {
                console.log('Unknown query results format:', parsed);
              }
            }
          }
          else if (source === 'aws') {
            // Load AWS logs
            const logStorage = sessionStorage.getItem('awsLogs');
            if (logStorage) {
              const parsed = JSON.parse(logStorage);
              if (Array.isArray(parsed)) {
                storedLogs = normalizeLogTimestamps(parsed);
              } else if (parsed.results && Array.isArray(parsed.results)) {
                storedLogs = normalizeLogTimestamps(parsed.results);
              } else {
                console.log('Unknown AWS logs format:', parsed);
              }
            }
          }
        }
        
        // If we still have no logs, check for any log-like data
        if (storedLogs.length === 0) {
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
                    storedLogs = normalizeLogTimestamps(convertedLogs);
                    break;
                  }
                }
              } catch (e) {
                console.error(`Error parsing potential logs from ${key}:`, e);
              }
            }
          }
        }
        
        // Validate logs have necessary fields
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
          console.log(`Loaded ${validatedLogs.length} logs from ${source} source`);
        } else {
          console.warn(`No logs found from ${source} source`);
        }
        
      } catch (error) {
        console.error('Error loading logs:', error);
        setError(`Failed to load logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLogs([]);
        setFilteredLogs([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadLogs();
  }, [extractSystemInfo, normalizeLogTimestamps, parseTimestamp]);

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
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
        <div className="w-24 h-24 mb-6 relative">
          {/* Logo - Log Analysis stylized logo */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-emerald-600 rounded-full opacity-20 animate-pulse"></div>
          <div className="absolute inset-2 bg-slate-900 rounded-full"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText className="w-12 h-12 text-indigo-400" />
          </div>
        </div>
        
        <div className="text-center">
          <h2 className="text-xl text-white font-medium mb-2">Loading Log Analysis</h2>
          <p className="text-slate-400 mb-4">Preparing your data for analysis</p>
          <div className="flex items-center justify-center">
            <div className="h-1 w-48 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 animate-progress-indeterminate"></div>
            </div>
          </div>
        </div>
      </div>
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

  return (
    <div 
      className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-gray-100'} ${isFullScreen ? 'p-0' : 'p-4 md:p-6'} ${darkMode ? 'text-white' : 'text-gray-900'} transition-all duration-300`}
      ref={fullscreenRef}
    >
      <div className={`${isFullScreen ? 'max-w-full' : 'max-w-6xl'} mx-auto`}>
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/')}
              className="mr-4 text-white/80 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold flex items-center">
              <Camera className="w-6 h-6 mr-2 text-blue-400" />
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
            <span className="text-slate-400 text-sm">
              {logs.length.toLocaleString()} logs total
            </span>
            
            {/* Tool buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleFullScreen}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
                title={isFullScreen ? "Exit Full Screen" : "Full Screen Mode"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
                title={darkMode ? "Light Mode" : "Dark Mode"}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              
              <button
                onClick={cycleFontSize}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
                title="Change Font Size"
              >
                <Type className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => setShowTools(!showTools)}
                className={`p-2 rounded-lg ${showTools ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'} transition`}
                title="Show Tools"
              >
                <Wrench className="w-4 h-4" />
              </button>
              
              <button
                onClick={exportLogs}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 transition flex items-center gap-2 text-sm rounded-lg"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              
              <button
                onClick={() => navigate('/dental-xray-monitoring')}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 transition flex items-center gap-2 text-sm rounded-lg"
              >
                <Monitor className="w-4 h-4" />
                Monitoring Dashboard
              </button>
              
              <button
                onClick={() => {
                  // Clear current logs and state
                  setLogs([]);
                  setFilteredLogs([]);
                  setIsLoading(true);
                  
                  // Navigate to query page to force a new query
                  navigate('/log-query');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 transition flex items-center gap-2 text-sm rounded-lg"
              >
                <Search className="w-4 h-4" />
                New Query
              </button>
              
              <button
                onClick={clearAllLogs}
                className="p-2 rounded-lg bg-red-700 hover:bg-red-600 transition"
                title="Clear All Logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Tools panel */}
        {showTools && (
          <div className="mb-6 bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center">
                <Wrench className="w-5 h-5 mr-2 text-blue-400" />
                Analysis Tools
              </h2>
              <button
                onClick={() => setShowTools(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-medium mb-2">Filtering Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Message Content</label>
                    <input 
                      type="text" 
                      placeholder="Filter by text content..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-700 border-slate-600 border rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm mb-1">Time Range</label>
                    <select
                      value={timeRange}
                      onChange={(e) => setTimeRange(e.target.value as any)}
                      className="w-full bg-slate-700 border-slate-600 border rounded-lg px-3 py-2 text-white"
                    >
                      <option value="all">All Time</option>
                      <option value="24h">Last 24 Hours</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="30d">Last 30 Days</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm mb-1">Log Level</label>
                    <div className="space-y-1">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={showErrorsOnly}
                          onChange={() => setShowErrorsOnly(!showErrorsOnly)}
                          className="mr-2"
                        />
                        <span>Errors Only</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={showWarningsOnly}
                          onChange={() => setShowWarningsOnly(!showWarningsOnly)}
                          className="mr-2"
                        />
                        <span>Warnings Only</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={removeDuplicates}
                          onChange={() => setRemoveDuplicates(!removeDuplicates)}
                          className="mr-2"
                        />
                        <span>Remove Duplicates</span>
                      </label>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setShowErrorsOnly(false);
                      setShowWarningsOnly(false);
                      setTimeRange('all');
                      setRemoveDuplicates(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="text-md font-medium mb-2">Export Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={exportLogs}
                    className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-2 justify-center"
                  >
                    <FileDown className="w-5 h-5" />
                    Export as Text
                  </button>
                  <button
                    onClick={() => {
                      const jsonData = JSON.stringify(filteredLogs, null, 2);
                      const blob = new Blob([jsonData], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `dental-xray-logs-${new Date().toISOString().split('T')[0]}.json`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    }}
                    className="p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm flex items-center gap-2 justify-center"
                  >
                    <FileDown className="w-5 h-5" />
                    Export as JSON
                  </button>
                  <button
                    onClick={() => {
                      // Export configuration only
                      if (xrayConfig) {
                        const configData = JSON.stringify(xrayConfig, null, 2);
                        const blob = new Blob([configData], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `dental-xray-config-${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      } else {
                        alert('No configuration data available to export.');
                      }
                    }}
                    className="p-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm flex items-center gap-2 justify-center"
                  >
                    <FileDown className="w-5 h-5" />
                    Export Config Only
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Configuration Status Section */}
        <div className="mb-6 bg-slate-800 rounded-xl border border-slate-700">
          <div 
            className="p-4 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('config')}
          >
            <h2 className="text-lg font-semibold flex items-center">
              <Settings className="w-5 h-5 mr-2 text-blue-400" />
              System Configuration
              {xrayConfig && !xrayConfig.isValid && (
                <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs">
                  Invalid Configuration
                </span>
              )}
            </h2>
            {expandedSections.config ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
          
          {expandedSections.config && (
            <div className="p-4 pt-0 border-t border-slate-700">
              {xrayConfig ? (
                <>
                  {/* Configuration Status */}
                  <div className={`p-4 mb-4 rounded-lg flex items-start gap-3 ${
                    xrayConfig.isValid ? 'bg-green-900/30 border border-green-700/50' : 'bg-red-900/30 border border-red-700/50'
                  }`}>
                    {xrayConfig.isValid ? (
                      <CheckCircle className="w-6 h-6 text-green-500 mt-1" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-500 mt-1" />
                    )}
                    <div>
                      <h3 className="font-medium text-lg">
                        {xrayConfig.isValid ? 'Configuration Valid' : 'Configuration Invalid'}
                      </h3>
                      <p className="text-slate-300">
                        {xrayConfig.isValid 
                          ? 'The system configuration is valid and the software should be functioning correctly.' 
                          : 'The system configuration is invalid. Please check the software settings and paths.'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Configuration Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <h3 className="text-blue-400 font-medium flex items-center gap-2 mb-3">
                        <Server className="w-4 h-4" />
                        X-ray Software
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Name:</span>
                          <span className="text-white font-medium capitalize">{xrayConfig.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Version:</span>
                          <span className="text-white font-medium">{xrayConfig.version}</span>
                        </div>
                        {xrayConfig.dbConfig && (
                          <div className="mt-4 pt-3 border-t border-slate-600">
                            <h4 className="text-blue-400 font-medium mb-2">Database Configuration</h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Server:</span>
                                <span className="text-white">{xrayConfig.dbConfig.server}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Database:</span>
                                <span className="text-white">{xrayConfig.dbConfig.database}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Port:</span>
                                <span className="text-white">{xrayConfig.dbConfig.port}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* System Paths */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <h3 className="text-blue-400 font-medium flex items-center gap-2 mb-3">
                        <HardDrive className="w-4 h-4" />
                        System Paths
                      </h3>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-slate-400">PM Bridge Path:</span>
                          <div className="bg-slate-800/70 p-2 rounded mt-1 overflow-x-auto whitespace-nowrap text-white">
                            {xrayConfig.pmBridgePath}
                          </div>
                        </div>
                        
                        {xrayConfig.romexisRadioPath && (
                          <div>
                            <span className="text-slate-400">Romexis Radio Path:</span>
                            <div className="bg-slate-800/70 p-2 rounded mt-1 overflow-x-auto whitespace-nowrap text-white">
                              {xrayConfig.romexisRadioPath}
                            </div>
                          </div>
                        )}
                        
                        {xrayConfig.vatechDbFolderPath && (
                          <div>
                            <span className="text-slate-400">VATECH DB Folder Path:</span>
                            <div className="bg-slate-800/70 p-2 rounded mt-1 overflow-x-auto whitespace-nowrap text-white">
                              {xrayConfig.vatechDbFolderPath}
                            </div>
                          </div>
                        )}
                        
                        {xrayConfig.carestreamRadioPath && (
                          <div>
                            <span className="text-slate-400">Carestream Radio Path:</span>
                            <div className="bg-slate-800/70 p-2 rounded mt-1 overflow-x-auto whitespace-nowrap text-white">
                              {xrayConfig.carestreamRadioPath}
                            </div>
                          </div>
                        )}
                        
                        {xrayConfig.isFormattedPatientIdMode !== undefined && (
                          <div>
                            <span className="text-slate-400">Formatted Patient ID Mode:</span>
                            <div className="bg-slate-800/70 p-2 rounded mt-1 text-white">
                              {xrayConfig.isFormattedPatientIdMode ? 'Enabled' : 'Disabled'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-6 text-slate-400">
                  <Server className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                  <p>No configuration data found in logs.</p>
                  <p className="text-sm mt-2">Check if configuration loading messages exist in the logs.</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* System Overview Section */}
        <div className="mb-6 bg-slate-800 rounded-xl border border-slate-700">
          <div 
            className="p-4 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('overview')}
          >
            <h2 className="text-lg font-semibold flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-400" />
              System Overview
            </h2>
            {expandedSections.overview ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
          
          {expandedSections.overview && (
            <div className="p-4 pt-0 border-t border-slate-700">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Camera className="w-4 h-4" />
                    <span className="text-sm font-medium">X-rays Taken</span>
                  </div>
                  <div className="text-2xl font-bold">{panoCount}</div>
                  <div className="text-xs text-blue-300/70 mt-1">
                    Valid panoramic X-rays
                  </div>
                </div>
                
                <div className="bg-purple-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-purple-400 mb-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Patients</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {new Set(treatments.filter(t => t.patientName !== 'Unknown Patient').map(t => t.patientName)).size}
                  </div>
                  <div className="text-xs text-purple-300/70 mt-1">
                    Unique patients processed
                  </div>
                </div>
                
                <div className="bg-amber-900/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">Last X-ray</span>
                  </div>
                  <div className="text-md font-bold">
                    {treatments.length > 0 
                      ? formatTimestamp(treatments[0].timestamp)
                      : 'N/A'
                    }
                  </div>
                  <div className="text-xs text-amber-300/70 mt-1">
                    Most recent activity
                  </div>
                </div>
              </div>
              
              {/* Charts Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h3 className="text-blue-400 font-medium mb-3 flex items-center">
                    <Radio className="w-4 h-4 mr-2" />
                    System Monitoring Stats
                  </h3>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'X-ray Success', value: treatments.length },
                          { name: 'Errors', value: errorCount },
                          { name: 'Unique Patients', value: new Set(treatments.filter(t => t.patientName !== 'Unknown Patient').map(t => t.patientName)).size }
                        ]}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '0.375rem'
                          }}
                        />
                        <Bar dataKey="value" name="Count">
                          <Cell fill="#3b82f6" /> {/* X-ray Success */}
                          <Cell fill="#ef4444" /> {/* Errors */}
                          <Cell fill="#8b5cf6" /> {/* Unique Patients */}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                {/* X-ray Activity Chart */}
                <div className="bg-slate-700/50 rounded-lg p-4">
                  <h3 className="text-blue-400 font-medium mb-3">X-ray Activity (7 Days)</h3>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyStats} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#94a3b8"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            const parts = value.split('-');
                            return `${parts[1]}/${parts[2]}`;
                          }}
                        />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '0.375rem'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="panos" 
                          name="X-rays" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="errors" 
                          name="Errors" 
                          stroke="#ef4444" 
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              {/* Recent Treatments */}
              <div className="bg-slate-700/50 rounded-lg p-4">
                <h3 className="text-blue-400 font-medium mb-3 flex items-center">
                  <Camera className="w-4 h-4 mr-2" />
                  Recent X-rays
                </h3>
                
                {treatments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-slate-600">
                          <th className="pb-2 text-slate-400 font-medium">Timestamp</th>
                          <th className="pb-2 text-slate-400 font-medium">Patient</th>
                          <th className="pb-2 text-slate-400 font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {treatments.slice(0, 5).map((treatment, index) => (
                          <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/30">
                            <td className="py-2">{formatTimestamp(treatment.timestamp)}</td>
                            <td className="py-2">{treatment.patientName}</td>
                            <td className="py-2">
                              <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-full text-xs">
                                {treatment.type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400">
                    No valid treatments found in logs.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Enhanced Log Viewer Section */}
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div 
            className="p-4 flex justify-between items-center cursor-pointer"
            onClick={() => toggleSection('logs')}
          >
            <h2 className="text-lg font-semibold flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-400" />
              Log Viewer
            </h2>
            {expandedSections.logs ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
          
          {expandedSections.logs && (
            <div className="p-4 pt-0 border-t border-slate-700">
              {/* Enhanced Mac-style Log Viewer */}
              <div className="bg-slate-900 rounded-lg border border-slate-700 mb-4">
                {/* Header toolbar */}
                <div className="bg-slate-800 p-2 rounded-t-lg border-b border-slate-700 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 text-sm font-medium">
                      Log entries ({filteredLogs.length.toLocaleString()})
                    </span>
                    
                    {/* Log level indicators */}
                    <div className="flex items-center gap-1 ml-2">
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                        {errorCount}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                        {warningCount}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* In-log search input (visible when search is active) */}
                    {isSearchingInLogs && (
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Search in logs..."
                          value={highlightText}
                          onChange={(e) => {
                            setHighlightText(e.target.value);
                            searchInLogs(e.target.value);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (e.shiftKey) {
                                // Previous match
                                setCurrentSearchIndex(prev => 
                                  prev > 0 ? prev - 1 : searchResults.length - 1
                                );
                              } else {
                                // Next match
                                setCurrentSearchIndex(prev => 
                                  prev < searchResults.length - 1 ? prev + 1 : 0
                                );
                              }
                              
                              // Scroll to the current search result
                              const currentIndex = e.shiftKey 
                                ? (currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1)
                                : (currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0);
                                
                              const logElement = document.getElementById(`log-${searchResults[currentIndex]}`);
                              if (logElement) {
                                logElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }
                            }
                          }}
                          className="w-64 bg-slate-700 border-slate-600 border rounded-lg pl-2 pr-20 py-1 text-sm text-white"
                          autoFocus
                        />
                        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-1 px-1">
                          {searchResults.length > 0 && (
                            <>
                              <span className="text-xs text-slate-400">
                                {currentSearchIndex + 1}/{searchResults.length}
                              </span>
                              <button
                                onClick={() => {
                                  setCurrentSearchIndex(prev => 
                                    prev > 0 ? prev - 1 : searchResults.length - 1
                                  );
                                  
                                  // Scroll to the current search result
                                  const logElement = document.getElementById(`log-${searchResults[
                                    currentSearchIndex > 0 ? currentSearchIndex - 1 : searchResults.length - 1
                                  ]}`);
                                  
                                  if (logElement) {
                                    logElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                }}
                                className="text-slate-400 hover:text-white p-1"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setCurrentSearchIndex(prev => 
                                    prev < searchResults.length - 1 ? prev + 1 : 0
                                  );
                                  
                                  // Scroll to the current search result
                                  const logElement = document.getElementById(`log-${searchResults[
                                    currentSearchIndex < searchResults.length - 1 ? currentSearchIndex + 1 : 0
                                  ]}`);
                                  
                                  if (logElement) {
                                    logElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  }
                                }}
                                className="text-slate-400 hover:text-white p-1"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setIsSearchingInLogs(false);
                              setHighlightText('');
                              setSearchResults([]);
                            }}
                            className="text-slate-400 hover:text-white p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Toolbar buttons */}
                    <div className="flex items-center gap-1">
                      {/* View mode toggle */}
                      <div className="flex border border-slate-600 rounded-lg overflow-hidden">
                        <button
                          onClick={() => setLogView('basic')}
                          className={`px-2 py-1 text-xs ${
                            logView === 'basic' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                          title="Basic view"
                        >
                          <BookOpen className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setLogView('detailed')}
                          className={`px-2 py-1 text-xs ${
                            logView === 'detailed' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                          title="Detailed view"
                        >
                          <Code className="w-3 h-3" />
                        </button>
                      </div>
                      
                      {/* Search toggle */}
                      <button
                        onClick={() => {
                          setIsSearchingInLogs(!isSearchingInLogs);
                          if (!isSearchingInLogs) {
                            setHighlightText('');
                            setSearchResults([]);
                          }
                        }}
                        className={`p-1 rounded ${
                          isSearchingInLogs 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                        }`}
                        title="Search in logs"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      
                      {/* Filter panel toggle */}
                      <button
                        onClick={() => setVisiblePanel(visiblePanel === 'filter' ? 'none' : 'filter')}
                        className={`p-1 rounded ${
                          visiblePanel === 'filter'
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                        }`}
                        title="Advanced filters"
                      >
                        <ListFilter className="w-4 h-4" />
                      </button>
                      
                      {/* Details panel toggle */}
                      <button
                        onClick={() => setVisiblePanel(visiblePanel === 'details' ? 'none' : 'details')}
                        className={`p-1 rounded ${
                          visiblePanel === 'details'
                            ? 'bg-blue-600 text-white' 
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                        }`}
                        title="Log details"
                      >
                        <PanelLeft className="w-4 h-4" />
                      </button>
                      
                      {/* JSON view toggle */}
                      <button
                        onClick={() => setViewJsonMode(!viewJsonMode)}
                        className={`p-1 rounded ${
                          viewJsonMode
                            ? 'bg-purple-600 text-white' 
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                        }`}
                        title={viewJsonMode ? "Text view" : "JSON view"}
                      >
                        <Code className="w-4 h-4" />
                      </button>
                      
                      {/* Copy all logs button */}
                      <button
                        onClick={() => {
                          // Create a text representation of the visible logs
                          const logText = paginatedLogs.map(log => 
                            `[${formatTimestamp(log.timestamp)}] [${log.severity.toUpperCase()}] ${log.message}`
                          ).join('\n');
                          
                          navigator.clipboard.writeText(logText)
                            .then(() => {
                              setCopiedLogId('all');
                              setTimeout(() => setCopiedLogId(null), 2000);
                            })
                            .catch(err => console.error('Could not copy logs: ', err));
                        }}
                        className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                        title="Copy visible logs"
                      >
                        {copiedLogId === 'all' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      
                      {/* Entries per page dropdown */}
                      <select
                        value={logsPerPage}
                        onChange={(e) => setLogsPerPage(Number(e.target.value))}
                        className="bg-slate-700 border-slate-600 border rounded-lg px-2 py-1 text-xs text-white"
                      >
                        {LOGS_PER_PAGE_OPTIONS.map(option => (
                          <option key={option} value={option}>
                            {option} per page
                          </option>
                        ))}
                      </select>
                      
                      {/* Clear filters button */}
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setShowErrorsOnly(false);
                          setShowWarningsOnly(false);
                          setTimeRange('all');
                          setSelectedLogStreams([]);
                          setRemoveDuplicates(false);
                        }}
                        className="text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Main content area with optional side panel */}
                <div className="flex">
                  {/* Side panel (filter or details) */}
                  {visiblePanel !== 'none' && (
                    <div className="w-64 border-r border-slate-700 bg-slate-800 p-3">
                      {visiblePanel === 'filter' ? (
                        <>
                          <h3 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                            <ListFilter className="w-4 h-4" />
                            Log Filters
                          </h3>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs mb-1 text-slate-400">Search Text</label>
                              <input 
                                type="text" 
                                placeholder="Filter by content..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-700 border-slate-600 border rounded-lg px-2 py-1 text-sm text-white"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-xs mb-1 text-slate-400">Time Range</label>
                              <select
                                value={timeRange}
                                onChange={(e) => setTimeRange(e.target.value as any)}
                                className="w-full bg-slate-700 border-slate-600 border rounded-lg px-2 py-1 text-sm text-white"
                              >
                                <option value="all">All Time</option>
                                <option value="24h">Last 24 Hours</option>
                                <option value="7d">Last 7 Days</option>
                                <option value="30d">Last 30 Days</option>
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-xs mb-1 text-slate-400">Log Level</label>
                              <div className="space-y-1">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={showErrorsOnly}
                                    onChange={() => setShowErrorsOnly(!showErrorsOnly)}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Errors Only</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={showWarningsOnly}
                                    onChange={() => setShowWarningsOnly(!showWarningsOnly)}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Warnings Only</span>
                                </label>
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={removeDuplicates}
                                    onChange={() => setRemoveDuplicates(!removeDuplicates)}
                                    className="mr-2"
                                  />
                                  <span className="text-sm">Remove Duplicates</span>
                                </label>
                              </div>
                            </div>
                            
                            {logStreams.length > 0 && (
                              <div>
                                <label className="block text-xs mb-1 text-slate-400">Log Streams</label>
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                  {logStreams.map(stream => (
                                    <label key={stream} className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={selectedLogStreams.includes(stream)}
                                        onChange={() => {
                                          if (selectedLogStreams.includes(stream)) {
                                            setSelectedLogStreams(prev => prev.filter(s => s !== stream));
                                          } else {
                                            setSelectedLogStreams(prev => [...prev, stream]);
                                          }
                                        }}
                                        className="mr-2"
                                      />
                                      <span className="text-sm truncate">{stream}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="pt-2">
                              <button
                                onClick={() => {
                                  setSearchTerm('');
                                  setShowErrorsOnly(false);
                                  setShowWarningsOnly(false);
                                  setTimeRange('all');
                                  setSelectedLogStreams([]);
                                  setRemoveDuplicates(false);
                                  setVisiblePanel('none');
                                }}
                                className="w-full px-3 py-1.5 bg-red-700 text-white rounded-lg hover:bg-red-600 transition text-sm"
                              >
                                Reset All Filters
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <h3 className="text-sm font-medium text-blue-400 mb-3 flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            Log Details
                          </h3>
                          
                          {selectedLog ? (
                            <div className="space-y-3">
                              <div>
                                <span className="text-xs text-slate-400 block">Timestamp:</span>
                                <span className="text-sm block mt-1">{formatTimestamp(selectedLog.timestamp)}</span>
                              </div>
                              
                              <div>
                                <span className="text-xs text-slate-400 block">Severity:</span>
                                <span className={`text-sm block mt-1 ${
                                  selectedLog.severity === 'error' ? 'text-red-400' : 
                                  selectedLog.severity === 'warning' ? 'text-amber-400' : 
                                  'text-blue-400'
                                }`}>
                                  {selectedLog.severity.toUpperCase()}
                                </span>
                              </div>
                              
                              {selectedLog.logStream && (
                                <div>
                                  <span className="text-xs text-slate-400 block">Log Stream:</span>
                                  <span className="text-sm block mt-1">{selectedLog.logStream}</span>
                                </div>
                              )}
                              
                              <div className="pt-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedLog.message)
                                      .then(() => {
                                        setCopiedLogId('selected');
                                        setTimeout(() => setCopiedLogId(null), 2000);
                                      });
                                  }}
                                  className="w-full px-3 py-1.5 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition text-sm flex items-center justify-center gap-2"
                                >
                                  {copiedLogId === 'selected' ? (
                                    <>
                                      <Check className="w-4 h-4" />
                                      Copied!
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4" />
                                      Copy Message
                                    </>
                                  )}
                                </button>
                              </div>
                              
                              <div>
                                <button
                                  onClick={() => {
                                    setHighlightText(''); // Clear any existing highlight
                                    setSearchTerm(selectedLog.message.substring(0, 40)); // Set first part as filter
                                  }}
                                  className="w-full px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-600 transition text-sm"
                                >
                                  Filter Similar
                                </button>
                              </div>
                              
                              {selectedLog.severity === 'error' && (
                                <div>
                                  <button
                                    onClick={() => {
                                      // Find related errors with similar text
                                      const errorPattern = selectedLog.message.split(' ').slice(0, 3).join(' ');
                                      setHighlightText(errorPattern);
                                      setShowErrorsOnly(true);
                                      setVisiblePanel('none');
                                    }}
                                    className="w-full px-3 py-1.5 bg-red-700 text-white rounded-lg hover:bg-red-600 transition text-sm"
                                  >
                                    Find Related Errors
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-400 italic">
                              Select a log entry to view details
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Logs area */}
                  <div className="flex-grow">
                    {filteredLogs.length > 0 ? (
                      <div className={`overflow-y-auto font-mono ${
                        isFullScreen ? 'h-[calc(100vh-320px)]' : 'max-h-96'
                      }`}>
                        {/* Improved Mac-like log display */}
                        <div className="py-1">
                          {paginatedLogs.map((log, index) => {
                            // Determine if this log is a current search result
                            const isCurrentSearchResult = searchResults[currentSearchIndex] === index;
                            
                            // Highlight search text if needed
                            let messageContent = log.message;
                            if (highlightText && messageContent.toLowerCase().includes(highlightText.toLowerCase())) {
                              const regex = new RegExp(`(${highlightText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                              messageContent = messageContent.replace(
                                regex, 
                                '<mark class="bg-yellow-500/30 text-yellow-200">$1</mark>'
                              );
                            }
                            
                            // Generate unique ID for this log entry
                            const logId = `log-${index}`;
                            
                            return (
                              <div 
                                key={logId}
                                id={logId}
                                className={`px-2 py-1 border-b border-slate-800 ${getFontSizeClass()} ${
                                  isCurrentSearchResult ? 'bg-blue-900/40' :
                                  selectedLog === log ? 'bg-slate-700/70' :
                                  log.severity === 'error' ? 'bg-red-900/20 text-red-200' : 
                                  log.severity === 'warning' ? 'bg-amber-900/20 text-amber-200' : 
                                  'text-slate-300'
                                } hover:bg-slate-800`}
                                onClick={() => setSelectedLog(log !== selectedLog ? log : null)}
                              >
                                <div className="flex items-start">
                                  <div className="shrink-0 mr-2 mt-0.5">
                                    {log.severity === 'error' ? (
                                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    ) : log.severity === 'warning' ? (
                                      <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                                    ) : (
                                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    )}
                                  </div>
                                  <div className="flex-grow">
                                    <div className="flex justify-between text-xs opacity-80 mb-0.5">
                                      <span>{formatTimestamp(log.timestamp)}</span>
                                      <div className="flex items-center gap-2">
                                        {log.logStream && (
                                          <span className="px-1.5 py-0.5 bg-slate-700/70 rounded text-slate-400 text-xs">
                                            {log.logStream}
                                          </span>
                                        )}
                                        <span className={`uppercase ${
                                          log.severity === 'error' ? 'text-red-400' : 
                                          log.severity === 'warning' ? 'text-amber-400' : 
                                          'text-blue-400'
                                        }`}>
                                          {log.severity}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {viewJsonMode && log.message.includes('{') ? (
                                      // JSON view for messages containing JSON
                                      <div className="whitespace-pre-wrap break-words">
                                        {(() => {
                                          try {
                                            const startIndex = log.message.indexOf('{');
                                            const prefix = log.message.substring(0, startIndex);
                                            const jsonStr = log.message.substring(startIndex);
                                            const jsonObj = JSON.parse(jsonStr);
                                            const formattedJson = JSON.stringify(jsonObj, null, 2);
                                            
                                            return (
                                              <>
                                                <div>{prefix}</div>
                                                <div className="bg-slate-800 p-2 rounded mt-1 text-xs overflow-x-auto">
                                                  <pre>{formattedJson}</pre>
                                                </div>
                                              </>
                                            );
                                          } catch (e) {
                                            // If JSON parsing fails, show raw message
                                            return messageContent;
                                          }
                                        })()}
                                      </div>
                                    ) : (
                                      // Regular view based on selected mode
                                      <div 
                                        className="whitespace-pre-wrap break-words"
                                        dangerouslySetInnerHTML={{__html: logView === 'basic' ? 
                                          // Basic view - minimal processing
                                          messageContent : 
                                          // Detailed view - enhanced processing
                                          processLogMessage(messageContent, log.severity)
                                        }}
                                      />
                                    )}
                                    
                                    {/* Action buttons for selected logs */}
                                    {selectedLog === log && (
                                      <div className="mt-2 flex gap-2">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation(); // Prevent toggling selection
                                            navigator.clipboard.writeText(log.message)
                                              .then(() => {
                                                setCopiedLogId(logId);
                                                setTimeout(() => setCopiedLogId(null), 2000);
                                              });
                                          }}
                                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-1"
                                        >
                                          {copiedLogId === logId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                          {copiedLogId === logId ? 'Copied!' : 'Copy'}
                                        </button>
                                        
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation(); // Prevent toggling selection
                                            setHighlightText(''); // Clear any existing highlight
                                            setSearchTerm(log.message.substring(0, 40)); // Set first part as filter
                                          }}
                                          className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded flex items-center gap-1"
                                        >
                                          <ListFilter className="w-3 h-3" />
                                          Filter Similar
                                        </button>
                                        
                                        {log.severity === 'error' && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation(); // Prevent toggling selection
                                              // Find related errors with similar text
                                              const errorPattern = log.message.split(' ').slice(0, 3).join(' ');
                                              setHighlightText(errorPattern);
                                              setShowErrorsOnly(true);
                                            }}
                                            className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800/70 rounded text-red-200 flex items-center gap-1"
                                          >
                                            <AlertCircle className="w-3 h-3" />
                                            Find Related Errors
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400">
                        <Info className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                        <p>No logs match your filters</p>
                        <button
                          onClick={() => {
                            setSearchTerm('');
                            setShowErrorsOnly(false);
                            setShowWarningsOnly(false);
                            setTimeRange('all');
                            setSelectedLogStreams([]);
                            setRemoveDuplicates(false);
                          }}
                          className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="border-t border-slate-700 px-4 py-2 flex items-center justify-between">
                    <div className="text-sm text-slate-400">
                      Page {currentPage} of {totalPages}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className={`
                          p-2 rounded-lg 
                          ${currentPage === 1 
                            ? 'text-slate-500 cursor-not-allowed' 
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                          }
                        `}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="sr-only">First</span>
                      </button>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className={`
                          p-2 rounded-lg 
                          ${currentPage === 1 
                            ? 'text-slate-500 cursor-not-allowed' 
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                          }
                        `}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="sr-only">Previous</span>
                      </button>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className={`
                          p-2 rounded-lg 
                          ${currentPage === totalPages 
                            ? 'text-slate-500 cursor-not-allowed' 
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                          }
                        `}
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span className="sr-only">Next</span>
                      </button>
                      
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className={`
                          p-2 rounded-lg 
                          ${currentPage === totalPages 
                            ? 'text-slate-500 cursor-not-allowed' 
                            : 'bg-slate-700 hover:bg-slate-600 text-white'
                          }
                        `}
                      >
                        <ChevronRight className="w-4 h-4" />
                        <span className="sr-only">Last</span>
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Log Stats */}
                <div className="px-4 py-2 text-sm text-slate-400 flex justify-between items-center border-t border-slate-700">
                  <div>
                    Showing {paginatedLogs.length} of {filteredLogs.length} logs (total: {logs.length})
                  </div>
                  <div className="flex items-center gap-3">
                    {errorCount > 0 && (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errorCount} errors
                      </span>
                    )}
                    {warningCount > 0 && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {warningCount} warnings
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Note about X-ray deduplication */}
              <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-700/30 text-sm">
                <div className="flex items-start">
                  <Info className="w-5 h-5 text-blue-400 mr-2 mt-0.5" />
                  <div>
                    <span className="font-medium text-blue-400">Note:</span> Only treatments with patient names containing masked information (asterisks) are counted as valid X-rays. Multiple logs for the same patient within 60 seconds are counted as a single X-ray.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            X-ray Log Analysis Dashboard | {new Date().toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LogAnalysisPage;