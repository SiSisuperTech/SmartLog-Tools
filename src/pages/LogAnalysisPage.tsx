import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DentalXrayMonitoring from '../pages/DentalXrayMonitoring';
import DentalXrayDashboard from '../components/DentalXrayDashboard';

import { Pie } from 'recharts';
import { 
  ChevronLeft, 
  Filter, 
  Search, 
  AlertCircle, 
  RefreshCw,
  Download,
  Sparkles,
  FileText,
  AlertTriangle,
  X,
  Calendar,
  Clock,
  PieChart,
  BarChart3,
  Layers,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  DatabaseBackup,
  Eye,
  LineChart as LineChartIcon,
  GitBranch,
  Bell,
  ExternalLink,
  Share2,
  Monitor
} from 'lucide-react';
import { LogViewer } from '../components/LogViewer';
import { format, parseISO, subHours, subDays, isValid, differenceInDays } from 'date-fns';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

// Extended types to fix TypeScript errors
interface LogEntry {
  timestamp: string;
  message: string;
  logStream?: string;
  severity: 'info' | 'warning' | 'error';
  id?: string;
}

interface LogAnalysis {
  mistralAnalysis: string;
  summary?: string;
  patterns?: string[];
  recommendations?: string[];
  errorRate?: number;
  timeDistribution?: Array<{hour: number, count: number}>;
  severity?: {
    info: number;
    warning: number;
    error: number;
  };
}

// Error pattern definitions with expanded categories
const ERROR_PATTERNS = [
  { name: 'Sentry', regex: /sentry/i },
  { name: 'Axios', regex: /axios|fetch|http/i },
  { name: 'Network', regex: /network|connection|timeout|socket|dns|offline/i },
  { name: 'Authentication', regex: /auth|unauthorized|forbidden|login|permission|access denied/i },
  { name: 'Database', regex: /db|database|query|sql|mongo|postgres|mysql|oracle/i },
  { name: 'Validation', regex: /validation|invalid|error|schema|type|constraint/i },
  { name: 'Rendering', regex: /render|component|ui|interface|display/i },
  { name: 'Memory', regex: /memory|allocation|heap|stack|overflow/i },
  { name: 'Performance', regex: /performance|slow|latency|timeout/i },
  { name: 'Syntax', regex: /syntax|parse|token|unexpected/i }
];

// Enhanced color palette for visualizations
const ERROR_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
  '#9966FF', '#FF9F40', '#E7E9ED', '#8EE1BC',
  '#D8E1E8', '#DF6FA0'
];

// Export formats
const EXPORT_FORMATS = [
  { label: 'JSON', value: 'json' },
  { label: 'CSV', value: 'csv' },
  { label: 'Text', value: 'txt' }
];

// Date range presets
const DATE_PRESETS = [
  { label: 'All Time', value: 'all' },
  { label: 'Last Hour', value: '1h' },
  { label: 'Last 6 Hours', value: '6h' },
  { label: 'Last 12 Hours', value: '12h' },
  { label: 'Last 24 Hours', value: '24h' },
  { label: 'Last 3 Days', value: '3d' },
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'Custom', value: 'custom' }
];

// Max logs to display per page options (increased for larger datasets)
const LOGS_PER_PAGE_OPTIONS = [25, 50, 100, 250, 500];

const LogAnalysisPage: React.FC = () => {
  const navigate = useNavigate();

  // Advanced view state
  const [showAdvancedView, setShowAdvancedView] = useState(false);
  const [viewMode, setViewMode] = useState<'monitoring' | 'dashboard'>('monitoring');
  
  // Core state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logSource, setLogSource] = useState<'aws' | 'manual' | 'query' | null>(null);
  
  // Chunk management for large datasets
  const [totalLogCount, setTotalLogCount] = useState<number>(0);
  const [chunkedStorage, setChunkedStorage] = useState<boolean>(false);
  const [loadedChunks, setLoadedChunks] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage, setLogsPerPage] = useState(100); // Increased default
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);
  const [removeDuplicates, setRemoveDuplicates] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'info' | 'warning' | 'error'>('all');
  const [selectedLogStreams, setSelectedLogStreams] = useState<string[]>([]);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [disableDateFilter, setDisableDateFilter] = useState(true);  // Start with date filtering disabled
  
  // New state for interactive filtering
  const [selectedErrorType, setSelectedErrorType] = useState<string | null>(null);
  const [selectedErrorMessage, setSelectedErrorMessage] = useState<string | null>(null);
  
  // Date range
  const [datePreset, setDatePreset] = useState<string>('all'); // Default to all time
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<LogAnalysis | null>(null);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');
  
  // UI state
  const [showTimeChart, setShowTimeChart] = useState(true);
  
  // Query state
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [directLogFetch, setDirectLogFetch] = useState(false);

  // Enhanced timestamp parsing with better detection of formats
  const parseTimestamp = (timestamp: string): Date | null => {
    if (!timestamp) return null;
    
    try {
      // First, ensure timestamp is in ISO format if it's in "YYYY-MM-DD HH:MM:SS" format
      let isoTimestamp = timestamp;
      if (typeof timestamp === 'string' && timestamp.includes(' ')) {
        isoTimestamp = timestamp.replace(' ', 'T') + 'Z';
      }
      
      // Now try parsing with various methods
      
      // Regular Date parsing (works for ISO strings)
      const date = new Date(isoTimestamp);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
      // Try numeric timestamp (milliseconds since epoch)
      if (/^\d+$/.test(String(timestamp))) {
        const numericDate = new Date(parseInt(String(timestamp)));
        if (!isNaN(numericDate.getTime())) {
          return numericDate;
        }
      }
      
      // Handle UTC format with explicit Z suffix
      if (typeof timestamp === 'string' && !timestamp.endsWith('Z') && 
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(timestamp)) {
        const utcDate = new Date(timestamp + 'Z');
        if (!isNaN(utcDate.getTime())) {
          return utcDate;
        }
      }
      
      // If all parsing attempts fail, log the issue and return null
      console.warn('Failed to parse timestamp:', timestamp);
      return null;
    } catch (e) {
      console.error('Error parsing timestamp:', timestamp, e);
      return null;
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    // First convert CloudWatch format to ISO if needed
    let timeStr = timestamp;
    if (typeof timestamp === 'string' && timestamp.includes(' ')) {
      timeStr = timestamp.replace(' ', 'T') + 'Z';
    }
    
    const date = parseTimestamp(timeStr);
    if (!date) return timestamp; // Return original if parsing fails
    
    // Format with date-fns to ensure consistent display
    try {
      return format(date, 'yyyy-MM-dd HH:mm:ss');
    } catch (e) {
      return timestamp;
    }
  };

  // Ensure logs have properly formatted timestamps
  const normalizeLogTimestamps = (logs: LogEntry[]): LogEntry[] => {
    return logs.map(log => {
      // Handle CloudWatch timestamp format
      if (log.timestamp && typeof log.timestamp === 'string' && log.timestamp.includes(' ')) {
        return {
          ...log,
          timestamp: log.timestamp.replace(' ', 'T') + 'Z'
        };
      }
      return log;
    });
  };

  // Store logs in chunks for large datasets to bypass storage limits
  const storeLogsInChunks = (logs: LogEntry[], source: string): boolean => {
    try {
      // Clear any previous storage
      const keys = Object.keys(sessionStorage).filter(key => key.startsWith(`${source}Logs_chunk_`));
      keys.forEach(key => sessionStorage.removeItem(key));
      
      // If there are too many logs for session storage, split them
      const MAX_CHUNK_SIZE = 1000; // Adjust based on browser limitations
      
      if (logs.length > MAX_CHUNK_SIZE) {
        console.log(`Storing ${logs.length} logs in chunks`);
        
        // Store basic metadata
        sessionStorage.setItem('logSource', source);
        sessionStorage.setItem('logCount', String(logs.length));
        
        // Store logs in chunks
        const chunks = Math.ceil(logs.length / MAX_CHUNK_SIZE);
        for (let i = 0; i < chunks; i++) {
          const start = i * MAX_CHUNK_SIZE;
          const end = Math.min(start + MAX_CHUNK_SIZE, logs.length);
          const chunk = logs.slice(start, end);
          sessionStorage.setItem(`${source}Logs_chunk_${i}`, JSON.stringify(chunk));
        }
        
        sessionStorage.setItem(`${source}Logs_chunks`, String(chunks));
        return true;
      } else {
        // Store as a single chunk if small enough
        sessionStorage.setItem('logSource', source);
        sessionStorage.setItem(`${source}Logs`, JSON.stringify({ results: logs }));
        return true;
      }
    } catch (error) {
      console.error('Error storing logs:', error);
      return false;
    }
  };

  // Load chunked logs
  const loadChunkedLogs = (source: string): LogEntry[] => {
    try {
      // Check if logs are chunked
      const chunksCount = sessionStorage.getItem(`${source}Logs_chunks`);
      
      if (chunksCount) {
        // Load logs from chunks
        const count = parseInt(chunksCount);
        let loadedLogs: LogEntry[] = [];
        
        for (let i = 0; i < count; i++) {
          const chunkStr = sessionStorage.getItem(`${source}Logs_chunk_${i}`);
          if (chunkStr) {
            try {
              const chunk = JSON.parse(chunkStr);
              loadedLogs = loadedLogs.concat(chunk);
            } catch (e) {
              console.error(`Error parsing chunk ${i}:`, e);
            }
          }
          
          // Update loading state
          setLoadedChunks(i + 1);
        }
        
        setTotalChunks(count);
        setChunkedStorage(true);
        return loadedLogs;
      } else {
        // Load from single storage
        const logStorage = sessionStorage.getItem(`${source}Logs`);
        if (logStorage) {
          const parsed = JSON.parse(logStorage);
          return parsed.results || [];
        }
      }
      
      return [];
    } catch (error) {
      console.error('Error loading chunked logs:', error);
      return [];
    }
  };

  // Query logs directly from API with selected date range
  const queryLogsDirectly = async () => {
    setIsLoading(true);
    setError(null);
    setDirectLogFetch(true);
    
    try {
      if (!startDate || !endDate) {
        throw new Error('Start date and end date are required for direct querying');
      }
      
      // Parse the startDate and endDate
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      
      // Get last used version from storage or default
      const lastVersion = sessionStorage.getItem('lastVersion') || '2.4.5';
      
      // Get location IDs (either from selectedLogStreams or last used locations)
      let locationIds = [];
      
      if (selectedLogStreams.length > 0) {
        // Extract location IDs from log streams if possible
        locationIds = selectedLogStreams
          .map(stream => {
            const match = stream.match(/\[production\]-\[\d+.\d+.\d+\]_\[(\d+)\]/);
            return match ? parseInt(match[1]) : null;
          })
          .filter(id => id !== null) as number[];
      }
      
      // Fallback to stored location IDs
      if (locationIds.length === 0) {
        const storedIds = sessionStorage.getItem('lastLocationIds');
        if (storedIds) {
          locationIds = JSON.parse(storedIds);
        } else {
          throw new Error('No location IDs available. Please perform a query first.');
        }
      }
      
      console.log(`Directly querying logs from ${new Date(startTimestamp * 1000).toISOString()} to ${new Date(endTimestamp * 1000).toISOString()}`);
      console.log(`Using version: ${lastVersion}, locationIds: ${locationIds.join(', ')}`);
      
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startTime: startTimestamp,
          endTime: endTimestamp,
          locationIds: locationIds,
          version: lastVersion,
          // No limit parameter - don't artificially limit results
        })
      });
      
      if (!response.ok) {
        throw new Error(`Query failed with status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`Received ${result.results?.length || 0} logs from direct query`);
      
      // Debug response format
      if (result.results?.length > 0) {
        console.log('Sample log from query:', result.results[0]);
      }
      
      // Normalize timestamps in log entries
      const normalizedLogs = normalizeLogTimestamps(result.results || []);
      
      // Sort logs (newest first)
      normalizedLogs.sort((a: LogEntry, b: LogEntry) => {
        const dateA = parseTimestamp(a.timestamp) || new Date(0);
        const dateB = parseTimestamp(b.timestamp) || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Store using chunking if needed
      storeLogsInChunks(normalizedLogs, 'direct');
      
      setLogs(normalizedLogs);
      setFilteredLogs(normalizedLogs);
      setLogSource('query');
      setTotalLogCount(normalizedLogs.length);
      
    } catch (error) {
      console.error('Error querying logs directly:', error);
      setError(error instanceof Error ? error.message : 'Unknown error during log query');
    } finally {
      setIsLoading(false);
      setDirectLogFetch(false);
    }
  };

  // Initialize date range on component mount
  useEffect(() => {
    // Set default date range (last 7 days)
    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);
    
    setStartDate(format(sevenDaysAgo, "yyyy-MM-dd'T'HH:mm"));
    setEndDate(format(now, "yyyy-MM-dd'T'HH:mm"));
  }, []);

  // Load logs from storage or API on component mount
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
        
        // Check if we have chunked logs
        const chunksCount = sessionStorage.getItem(`${source}Logs_chunks`);
        let storedLogs: LogEntry[] = [];
        
        if (chunksCount) {
          console.log(`Loading chunked logs: ${chunksCount} chunks`);
          setTotalChunks(parseInt(chunksCount));
          setChunkedStorage(true);
          
          // Load logs from chunks
          storedLogs = loadChunkedLogs(source);
          const logCount = sessionStorage.getItem('logCount');
          if (logCount) {
            setTotalLogCount(parseInt(logCount));
          } else {
            setTotalLogCount(storedLogs.length);
          }
        } else {
          setChunkedStorage(false);
          
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
            // Load query results
            const queryResults = sessionStorage.getItem(`${source}Logs`);
            if (queryResults) {
              const parsed = JSON.parse(queryResults);
              const rawLogs = parsed.results || [];
              storedLogs = normalizeLogTimestamps(rawLogs);
            }
          }
          else if (source === 'aws') {
            // Load AWS logs
            const logStorage = sessionStorage.getItem('awsLogs');
            if (logStorage) {
              const parsed = JSON.parse(logStorage);
              const rawLogs = parsed.results || [];
              
              // Debug a sample log
              if (rawLogs.length > 0) {
                console.log('Sample raw log before normalization:', rawLogs[0]);
              }
              
              // Normalize timestamps (convert CloudWatch format to ISO)
              storedLogs = normalizeLogTimestamps(rawLogs);
              
              // Debug normalized log
              if (storedLogs.length > 0) {
                console.log('Sample normalized log:', storedLogs[0]);
              }
            }
          }
          
          setTotalLogCount(storedLogs.length);
        }
        
        // Validate logs have message field, add placeholder if missing
        const validatedLogs = storedLogs.map(log => ({
          ...log,
          message: log.message || 'No content available'
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
        console.log(`Loaded ${validatedLogs.length} logs from ${source} source`);
        
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
  }, []);

  // Extract unique log streams for filtering
  const logStreams = useMemo(() => {
    console.time('extract-streams');
    const streams = new Set<string>();
    logs.forEach(log => {
      if (log.logStream) {
        streams.add(log.logStream);
      }
    });
    const result = Array.from(streams);
    console.timeEnd('extract-streams');
    return result;
  }, [logs]);

  
  useEffect(() => {
    if (datePreset === 'custom') {
      // Custom range is handled separately with the date pickers
      setDisableDateFilter(false);
      return;
    }
    
    if (datePreset === 'all') {
      // Clear date filters
      setStartDate('');
      setEndDate('');
      setDisableDateFilter(true);
      console.log('Date range cleared - all time view enabled');
      return;
    }
    
    setDisableDateFilter(false);
    const now = new Date();
    let start: Date | null = null;
    
    switch (datePreset) {
      case '1h':
        start = subHours(now, 1);
        break;
      case '6h':
        start = subHours(now, 6);
        break;
      case '12h':
        start = subHours(now, 12);
        break;
      case '24h':
        start = subHours(now, 24);
        break;
      case '3d':
        start = subDays(now, 3);
        break;
      case '7d':
        start = subDays(now, 7);
        break;
      case '30d':
        start = subDays(now, 30);
        break;
      default:
        // 'all' or undefined - no date filtering
        break;
    }
    
    if (start) {
      setStartDate(format(start, "yyyy-MM-dd'T'HH:mm"));
      setEndDate(format(now, "yyyy-MM-dd'T'HH:mm"));
      
      // Apply filtering immediately
      console.log(`Date range set: ${format(start, "yyyy-MM-dd HH:mm")} to ${format(now, "yyyy-MM-dd HH:mm")}`);
      
      // Force refresh filtered logs
      setFilteredLogs(prev => {
        // This will trigger the useEffect that filters logs
        return [...prev];
      });
    }
  }, [datePreset]);
  // Reset interactive filters when search or other filters change
  useEffect(() => {
    if (searchTerm || selectedSeverity !== 'all' || showErrorsOnly || showWarningsOnly) {
      setSelectedErrorType(null);
      setSelectedErrorMessage(null);
    }
  }, [searchTerm, selectedSeverity, showErrorsOnly, showWarningsOnly]);

  // Apply filters to logs - optimized for large datasets
  useEffect(() => {
    console.time('filtering');
    console.log(`Filtering ${logs.length} logs...`);
    
    // Check if there are any logs to filter
    if (!logs.length) {
      console.log('No logs to filter');
      setFilteredLogs([]);
      console.timeEnd('filtering');
      return;
    }
    
    // Ensure timestamps are in ISO format for date filtering
    // (this is a safeguard even though we normalize on load)
    const logsWithIsoTimestamps = logs.map(log => {
      if (log.timestamp && typeof log.timestamp === 'string' && log.timestamp.includes(' ')) {
        return {
          ...log,
          timestamp: log.timestamp.replace(' ', 'T') + 'Z'
        };
      }
      return log;
    });
    
    let result = [...logsWithIsoTimestamps];
    
    // Skip date filtering if disabled
    if (!disableDateFilter) {
      // Filter by date range first (most efficient)
      if (startDate && isValid(parseISO(startDate))) {
        console.time('date-filter-start');
        const startDateTime = new Date(startDate).getTime();
        const beforeCount = result.length;
        
        // Debug sample timestamps
        if (result.length > 0) {
          console.log('Sample log timestamps before filtering:');
          result.slice(0, 3).forEach((log, i) => {
            const parsedDate = parseTimestamp(log.timestamp);
            console.log(`Log ${i}: "${log.timestamp}" → ${parsedDate ? parsedDate.toISOString() : 'Failed to parse'}`);
          });
        }
        
        result = result.filter(log => {
          const logDate = parseTimestamp(log.timestamp);
          return logDate ? logDate.getTime() >= startDateTime : true; // Keep logs with unparsable dates
        });
        
        console.timeEnd('date-filter-start');
        console.log(`After start date filter (${startDate}): ${result.length} logs remaining, filtered out ${beforeCount - result.length}`);
      }
      
      if (endDate && isValid(parseISO(endDate))) {
        console.time('date-filter-end');
        // Add 24 hours to end date to make it inclusive of the whole day
        const endDateTime = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1000);
        const beforeCount = result.length;
        
        result = result.filter(log => {
          const logDate = parseTimestamp(log.timestamp);
          return logDate ? logDate.getTime() <= endDateTime : true; // Keep logs with unparsable dates
        });
        
        console.timeEnd('date-filter-end');
        console.log(`After end date filter (${endDate} + 24h): ${result.length} logs remaining, filtered out ${beforeCount - result.length}`);
      }
    }
    
    // Filter by search term
    if (searchTerm) {
      console.time('search-filter');
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        (log.message && log.message.toLowerCase().includes(term)) || 
        (log.logStream && log.logStream.toLowerCase().includes(term))
      );
      console.timeEnd('search-filter');
      console.log(`After search filter: ${result.length} logs remaining`);
    }
    
    // Filter by selected error type
    if (selectedErrorType) {
      console.time('error-type-filter');
      const pattern = ERROR_PATTERNS.find(p => p.name === selectedErrorType)?.regex;
      if (pattern) {
        result = result.filter(log => pattern.test(log.message));
      }
      console.timeEnd('error-type-filter');
      console.log(`After error type filter (${selectedErrorType}): ${result.length} logs remaining`);
    }
    
    // Filter by selected error message
    if (selectedErrorMessage) {
      console.time('error-message-filter');
      result = result.filter(log => log.message === selectedErrorMessage);
      console.timeEnd('error-message-filter');
      console.log(`After error message filter: ${result.length} logs remaining`);
    }
    
    // Filter by log severity - FIXED LOGIC
    if (selectedSeverity !== 'all') {
      console.time('severity-filter');
      result = result.filter(log => log.severity === selectedSeverity);
      console.timeEnd('severity-filter');
      console.log(`After severity filter (${selectedSeverity}): ${result.length} logs remaining`);
    } else {
      // Apply both filters if both are checked
      if (showErrorsOnly && showWarningsOnly) {
        console.time('errors-warnings-filter');
        result = result.filter(log => log.severity === 'error' || log.severity === 'warning');
        console.timeEnd('errors-warnings-filter');
        console.log(`After errors+warnings filter: ${result.length} logs remaining`);
      }
      // Apply only error filter if only errors checked  
      else if (showErrorsOnly) {
        console.time('errors-filter');
        result = result.filter(log => log.severity === 'error');
        console.timeEnd('errors-filter');
        console.log(`After errors filter: ${result.length} logs remaining`);
      }
      // Apply only warning filter if only warnings checked
      else if (showWarningsOnly) {
        console.time('warnings-filter');
        result = result.filter(log => log.severity === 'warning');
        console.timeEnd('warnings-filter');
        console.log(`After warnings filter: ${result.length} logs remaining`);
      }
    }
    
    // Filter by log streams
    if (selectedLogStreams.length > 0) {
      console.time('streams-filter');
      result = result.filter(log => 
        log.logStream && selectedLogStreams.includes(log.logStream)
      );
      console.timeEnd('streams-filter');
      console.log(`After log streams filter: ${result.length} logs remaining`);
    }
    
    // Remove duplicates if enabled
    if (removeDuplicates) {
      console.time('duplicates-filter');
      const seen = new Set();
      result = result.filter(log => {
        const key = `${log.message}-${log.logStream}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      console.timeEnd('duplicates-filter');
      console.log(`After duplicates filter: ${result.length} logs remaining`);
    }
    
    console.timeEnd('filtering');
    console.log(`Filtering complete: ${logs.length} → ${result.length} logs`);
    
    setFilteredLogs(result);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [
    logs, 
    searchTerm, 
    selectedSeverity, 
    showErrorsOnly,
    showWarningsOnly,
    removeDuplicates, 
    startDate, 
    endDate,
    selectedLogStreams,
    disableDateFilter,
    selectedErrorType,
    selectedErrorMessage
  ]);

  // Calculate pagination
  const paginatedLogs = useMemo(() => {
    console.time('pagination');
    const startIndex = (currentPage - 1) * logsPerPage;
    const result = filteredLogs.slice(startIndex, startIndex + logsPerPage);
    console.timeEnd('pagination');
    return result;
  }, [filteredLogs, currentPage, logsPerPage]);

  const totalPages = useMemo(() => 
    Math.ceil(filteredLogs.length / logsPerPage)
  , [filteredLogs, logsPerPage]);

  // Detect error types and categories
  const detectErrorTypes = useMemo(() => {
    console.time('error-types');
    const errorLogs = logs.filter(log => log.severity === 'error');

    const errorTypeCounts: Record<string, number> = {};
    const uncategorized: Array<LogEntry> = [];

    errorLogs.forEach((log: LogEntry) => {
      let matched = false;
      
      ERROR_PATTERNS.forEach(pattern => {
        if (log.message && pattern.regex.test(log.message)) {
          errorTypeCounts[pattern.name] = 
            (errorTypeCounts[pattern.name] || 0) + 1;
          matched = true;
        }
      });
      
      if (!matched) {
        uncategorized.push(log);
      }
    });

    // Add uncategorized errors if they exist
    if (uncategorized.length > 0) {
      errorTypeCounts['Other'] = uncategorized.length;
    }

    const result = Object.entries(errorTypeCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a: {name: string, count: number}, b: {name: string, count: number}) => b.count - a.count);
    
    console.timeEnd('error-types');
    return result;
  }, [logs]);

  // Calculate error distribution by log stream
  const errorsByLogStream = useMemo(() => {
    console.time('errors-by-stream');
    const result: Record<string, number> = {};
    
    logs.filter(log => log.severity === 'error').forEach(log => {
      const stream = log.logStream || 'unknown';
      result[stream] = (result[stream] || 0) + 1;
    });
    
    const streamErrors = Object.entries(result)
      .map(([stream, count]) => ({ stream, count }))
      .sort((a: {stream: string, count: number}, b: {stream: string, count: number}) => b.count - a.count)
      .slice(0, 5); // Top 5 streams with errors
    
    console.timeEnd('errors-by-stream');
    return streamErrors;
  }, [logs]);

  // Calculate error distribution over time
  const errorsOverTime = useMemo(() => {
    console.time('errors-over-time');
    const timeFrames: Record<string, {errors: number, warnings: number, info: number}> = {};
    
    logs.forEach(log => {
      try {
        const date = parseTimestamp(log.timestamp);
        if (!date) return;
        
        // Group by day for trends
        const timeKey = format(date, 'yyyy-MM-dd');
        
        if (!timeFrames[timeKey]) {
          timeFrames[timeKey] = {errors: 0, warnings: 0, info: 0};
        }
        
        const severity = log.severity || 'info';
        if (severity === 'error') timeFrames[timeKey].errors++;
        else if (severity === 'warning') timeFrames[timeKey].warnings++;
        else timeFrames[timeKey].info++;
      } catch (e) {
        // Skip invalid dates
      }
    });
    
    const result = Object.entries(timeFrames)
      .map(([date, counts]) => ({
        date,
        ...counts
      }))
      .sort((a: {date: string}, b: {date: string}) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    console.timeEnd('errors-over-time');
    return result;
  }, [logs]);

  // Top error messages for filtering
  const topErrorMessages = useMemo(() => {
    return logs
      .filter(log => log.severity === 'error')
      .reduce((acc, log) => {
        const existing = acc.find(item => item.message === log.message);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ message: log.message, count: 1 });
        }
        return acc;
      }, [] as Array<{message: string, count: number}>)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [logs]);

  // Handle error type click
  const handleErrorTypeClick = useCallback((errorType: string) => {
    // Toggle selection
    setSelectedErrorType(prevType => prevType === errorType ? null : errorType);
    
    // Clear other filters
    setSelectedErrorMessage(null);
    setSearchTerm('');
    
    // Set severity to errors only if not already selected
    if (selectedSeverity !== 'error') {
      setSelectedSeverity('error');
    }
  }, [selectedSeverity]);

  // Handle error message click
  const handleErrorMessageClick = useCallback((message: string) => {
    // Toggle selection
    setSelectedErrorMessage(prevMessage => prevMessage === message ? null : message);
    
    // Clear other filters
    setSelectedErrorType(null);
    setSearchTerm('');
    
    // Set severity to errors only if not already selected
    if (selectedSeverity !== 'error') {
      setSelectedSeverity('error');
    }
  }, [selectedSeverity]);

  // AI Analysis with enhanced capabilities and better error handling
  const analyzeWithAI = async () => {
    if (!filteredLogs.length) return;
    
    setIsAnalyzing(true);
    
    try {
      // Determine logs to analyze
      let logsToAnalyze = filteredLogs;
      
      // If there are too many logs, focus on errors and warnings first,
      // then add some info logs if needed
      if (filteredLogs.length > 200) {
        const errors = filteredLogs.filter(log => log.severity === 'error');
        const warnings = filteredLogs.filter(log => log.severity === 'warning');
        const info = filteredLogs.filter(log => log.severity === 'info');
        
        // Prioritize errors and warnings
        logsToAnalyze = [...errors, ...warnings];
        
        // If we still have room, add some info logs
        if (logsToAnalyze.length < 200) {
          logsToAnalyze = [...logsToAnalyze, ...info.slice(0, 200 - logsToAnalyze.length)];
        }
        
        // If we have too many logs, trim to the most recent 200
        if (logsToAnalyze.length > 200) {
          logsToAnalyze = logsToAnalyze.slice(0, 200);
        }
      }
      
      console.log(`Analyzing ${logsToAnalyze.length} logs with AI`);
      
      // Fallback analysis in case API fails
      const generateFallbackAnalysis = () => {
        // Get error counts
        const errorCount = logsToAnalyze.filter(log => log.severity === 'error').length;
        const warningCount = logsToAnalyze.filter(log => log.severity === 'warning').length;
        const infoCount = logsToAnalyze.filter(log => log.severity === 'info').length;
        
        // Find most common error types
        const errorTypes = new Map();
        logsToAnalyze.filter(log => log.severity === 'error').forEach(log => {
          ERROR_PATTERNS.forEach(pattern => {
            if (pattern.regex.test(log.message)) {
              errorTypes.set(pattern.name, (errorTypes.get(pattern.name) || 0) + 1);
            }
          });
        });
        
        // Sort error types by frequency
        const topErrorTypes = Array.from(errorTypes.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => `${name} (${count} occurrences)`);
        
        return {
          mistralAnalysis: `Analysis of ${logsToAnalyze.length} logs:\n\n${errorCount} errors, ${warningCount} warnings, and ${infoCount} info logs were found.\n\nCommon error patterns include network connectivity issues, validation errors, and authentication problems.\n\nRecommend reviewing recent code deployments and network configuration.`,
          summary: `Found ${errorCount} errors, ${warningCount} warnings, and ${infoCount} info logs.`,
          patterns: topErrorTypes,
          recommendations: [
            "Review recent code deployments and configuration changes",
            "Check network connectivity and API endpoints",
            "Verify authentication mechanisms are working properly",
            "Ensure proper validation is implemented for user inputs",
            "Consider adding more detailed logging for better diagnostics"
          ],
          errorRate: (errorCount / logsToAnalyze.length) * 100,
          severity: {
            info: infoCount,
            warning: warningCount,
            error: errorCount
          }
        };
      };
      
      try {
        const response = await fetch('/api/analyze-logs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            logs: logsToAnalyze,
            // Additional analysis options
            options: {
              detectPatterns: true,
              suggestFixes: true,
              prioritizeIssues: true,
              calculateStats: true
            }
          })
        });
        
        if (!response.ok) {
          console.warn('API response not OK, using fallback analysis');
          setAnalysis(generateFallbackAnalysis());
          return;
        }
        
        const result = await response.json();
        console.log('Analysis result:', result);
        
        // Check if result has expected structure
        if (!result || !result.mistralAnalysis) {
          console.warn('Invalid API response, using fallback analysis');
          setAnalysis(generateFallbackAnalysis());
          return;
        }
        
        // Convert pattern objects to strings if needed
        const processedResult = {
          ...result,
          patterns: result.patterns ? 
            (Array.isArray(result.patterns) ? 
              (typeof result.patterns[0] === 'string' ? 
                result.patterns : 
                result.patterns.map((p: any) => `${p.pattern} (${p.count} occurrences)`)
              ) : 
              []
            ) : 
            [],
          recommendations: result.recommendations || []
        };
        
        setAnalysis(processedResult);
      } catch (error) {
        console.error('Error during API call:', error);
        // If API fails, generate fallback analysis
        setAnalysis(generateFallbackAnalysis());
      }
    } catch (error) {
      console.error('Error analyzing logs:', error);
      // Show error but don't alert (better UX)
      setAnalysis({
        mistralAnalysis: "Error occurred during analysis. Using basic statistics instead.",
        patterns: [],
        recommendations: ["Try again with a smaller dataset or more specific filters."],
        errorRate: 0,
        severity: { info: 0, warning: 0, error: 0 }
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

 

const exportLogs = () => {
  const filename = `log-export-${format(new Date(), 'yyyy-MM-dd-HH-mm')}`;
  
  // Create a nicely formatted text output for better readability
  const header = "====== DENTAL X-RAY SYSTEM LOG EXPORT ======\n";
  const timestamp = `Export Date: ${format(new Date(), 'MMMM d, yyyy HH:mm:ss')}\n`;
  const summary = `Total Logs: ${logs.length}\nFiltered Logs: ${filteredLogs.length}\n`;
  const divider = "===========================================\n\n";
  
  const logEntries = filteredLogs.map(log => 
    `[${formatTimestamp(log.timestamp)}] [${log.severity.toUpperCase()}] ${log.message}`
  ).join('\n');
  
  const dataStr = header + timestamp + summary  + logEntries;
  const mimeType = 'text/plain';
  const extension = 'txt';
  
  const blob = new Blob([dataStr], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  setShowExportOptions(false);
};

  // Toggle log stream selection
  const toggleLogStream = (stream: string) => {
    setSelectedLogStreams(prev => 
      prev.includes(stream)
        ? prev.filter(s => s !== stream)
        : [...prev, stream]
    );
  };

  // Prepare logs for LogViewer - handle empty messages and format timestamps
  const prepareLogsForViewer = (logs: LogEntry[]): { 
    timestamp: string; 
    message: string; 
    logStream: string; 
    severity: 'info' | 'warning' | 'error';
    id?: string;
  }[] => {
    return logs.map(log => {
      // Ensure all fields have values
      return {
        ...log,
        timestamp: formatTimestamp(log.timestamp), // Format timestamp for display
        message: log.message || 'No content available', // Provide default for empty messages
        logStream: log.logStream || 'unknown'
      };
    });
  };

  // Format data for time chart
  const timeChartData = useMemo(() => {
    return errorsOverTime.map(item => ({
      date: item.date,
      errors: item.errors,
      warnings: item.warnings,
      info: item.info
    }));
  }, [errorsOverTime]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 text-white flex items-center justify-center">
        <div className="flex flex-col items-center">
          <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mb-4" />
          <h2 className="text-xl font-semibold">Loading Logs...</h2>
          {chunkedStorage && (
            <p className="mt-2 text-slate-300">
              Loading chunk {loadedChunks} of {totalChunks}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 text-white flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700 text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-6" />
          <h2 className="text-2xl font-semibold mb-4">Error Loading Logs</h2>
          <p className="text-slate-300 mb-6">
            {error}
          </p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/')}
              className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No logs found state
  if (!logs.length) {
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

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6 text-white">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div className="flex items-center mb-4 md:mb-0">
            <button 
              onClick={() => navigate('/')}
              className="mr-4 text-white/80 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-semibold">Log Analysis</h1>
            {logSource && (
              <span className="ml-3 px-2 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs uppercase">
                {logSource}
              </span>
            )}
            <span className="ml-3 text-slate-400 text-sm">
              {totalLogCount.toLocaleString()} logs total, {filteredLogs.length.toLocaleString()} filtered
            </span>
          </div>
          
          

          <div className="flex flex-wrap gap-2">
  {/* Advanced X-ray Analysis button */}
  <button
    onClick={() => setShowAdvancedView(true)}
    className="bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition flex items-center gap-2 text-sm"
  >
    <Monitor className="w-4 h-4" />
    Advanced X-ray Analysis
  </button>

  <div className="relative">
    <button
      onClick={() => setShowExportOptions(!showExportOptions)}
      className="bg-slate-700 text-white px-3 py-1.5 rounded-lg hover:bg-slate-600 transition flex items-center gap-2 text-sm"
    >
      <Download className="w-4 h-4" />
      Export Logs
    </button>
    
    {showExportOptions && (
      <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 z-10">
        <div className="p-2">
          <div className="text-sm font-medium mb-2 px-2">Export Format</div>
          {EXPORT_FORMATS.map(format => (
            <button
              key={format.value}
              onClick={() => {
                setExportFormat(format.value);
                exportLogs();
              }}
              className="w-full text-left px-3 py-2 hover:bg-slate-700 rounded-md text-sm transition"
            >
              {format.label}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
  
  {/* New Query button */}
  <button
    onClick={() => window.location.href = '/log-query'}
    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm"
  >
    <Search className="w-4 h-4" />
    New Query
  </button>
</div>
        </div>

        {/* Advanced View UI */}
        {showAdvancedView ? (
          <>
            {/* Toggle between monitoring and dashboard views */}
            <div className="mb-4 flex justify-end">
              <div className="inline-flex rounded-md shadow-sm" role="group">
                <button
                  type="button"
                  onClick={() => setViewMode('monitoring')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                    viewMode === 'monitoring' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Monitoring
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('dashboard')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                    viewMode === 'dashboard' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Dashboard
                </button>
              </div>
            </div>
            
           

            {viewMode === 'monitoring' ? (
  <DentalXrayMonitoring
    logs={logs.map(log => ({
      ...log,
      logStream: log.logStream || 'unknown',
      // Ensure all required properties exist
      severity: log.severity || 'info',
      message: log.message || 'No message',
      timestamp: log.timestamp || new Date().toISOString()
    }))} 
    onBackClick={() => setShowAdvancedView(false)}
  />
) : (
  <DentalXrayDashboard
    logs={logs.map(log => ({
      ...log,
      logStream: log.logStream || 'unknown',
      // Ensure all required properties exist
      severity: log.severity || 'info',
      message: log.message || 'No message',
      timestamp: log.timestamp || new Date().toISOString()
    }))}
    onBackClick={() => setShowAdvancedView(false)}
  />
)}
          </>
        ) : (
          <>
            {/* Filters */}
            <div className="mb-6 bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
                <div className="relative flex-grow max-w-xl">
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  className="flex items-center gap-2 bg-slate-700 px-3 py-2 rounded-lg hover:bg-slate-600 transition text-sm"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters {showFiltersPanel ? '▲' : '▼'}
                </button>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <select
                      value={datePreset}
                      onChange={(e) => setDatePreset(e.target.value)}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                    >
                      {DATE_PRESETS.map(preset => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Clear all filters button */}
                  <button
                    onClick={() => {
                      // Reset all filters to default state
                      setSearchTerm('');
                      setSelectedSeverity('all');
                      setShowErrorsOnly(false);
                      setShowWarningsOnly(false);
                      setRemoveDuplicates(false);
                      setSelectedLogStreams([]);
                      setDatePreset('all');
                      setStartDate('');
                      setEndDate('');
                      setDisableDateFilter(true);
                      setSelectedErrorType(null);
                      setSelectedErrorMessage(null);
                    }}
                    className="bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition flex items-center gap-2 text-sm"
                  >
                    <X className="w-4 h-4" />
                    Reset All Filters
                  </button>
                </div>
              </div>
              
              {/* Active filters display */}
              {(selectedErrorType || selectedErrorMessage) && (
                <div className="mt-2 flex items-center gap-2 bg-blue-900/30 p-2 rounded-lg border border-blue-600/30">
                  <span className="text-blue-300 text-sm">Active Filter:</span>
                  {selectedErrorType && (
                    <div className="bg-blue-600/50 text-white rounded-full py-1 px-3 text-xs flex items-center gap-1">
                      <span>Error Type: {selectedErrorType}</span>
                      <button 
                        onClick={() => setSelectedErrorType(null)} 
                        className="text-white/70 hover:text-white"
                        aria-label="Clear error type filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {selectedErrorMessage && (
                    <div className="bg-blue-600/50 text-white rounded-full py-1 px-3 text-xs flex items-center gap-1 max-w-md truncate">
                      <span>Error Message: {selectedErrorMessage.substring(0, 50)}{selectedErrorMessage.length > 50 ? '...' : ''}</span>
                      <button 
                        onClick={() => setSelectedErrorMessage(null)} 
                        className="text-white/70 hover:text-white flex-shrink-0"
                        aria-label="Clear error message filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={() => {
                      setSelectedErrorType(null);
                      setSelectedErrorMessage(null);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 ml-2"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
              
              {showFiltersPanel && (
                <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Date Range */}
                  {datePreset === 'custom' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Custom Date Range</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex-1">
                          <div className="text-xs text-slate-400 mb-1">Start Date</div>
                          <input 
                            type="datetime-local"
                            value={startDate}
                            onChange={(e) => {
                              setStartDate(e.target.value);
                              setDisableDateFilter(false);
                              // Set end date to 7 days after if not already set
                              if (e.target.value && (!endDate || endDate === '')) {
                                const startDate = new Date(e.target.value);
                                const sevenDaysLater = new Date(startDate);
                                sevenDaysLater.setDate(startDate.getDate() + 7);
                                setEndDate(format(sevenDaysLater, "yyyy-MM-dd'T'HH:mm"));
                              }
                            }}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-slate-400 mb-1">End Date</div>
                          <input 
                            type="datetime-local"
                            value={endDate}
                            onChange={(e) => {
                              setEndDate(e.target.value);
                              setDisableDateFilter(false);
                              // Set start date to 7 days before if not already set
                              if (e.target.value && (!startDate || startDate === '')) {
                                const endDate = new Date(e.target.value);
                                const sevenDaysBefore = new Date(endDate);
                                sevenDaysBefore.setDate(endDate.getDate() - 7);
                                setStartDate(format(sevenDaysBefore, "yyyy-MM-dd'T'HH:mm"));
                              }
                            }}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Severity Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Log Severity</label>
                    <div className="space-y-1">
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="severity-all"
                          name="severity"
                          checked={selectedSeverity === 'all'}
                          onChange={() => setSelectedSeverity('all')}
                          className="text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <label htmlFor="severity-all" className="text-white text-sm">All Severities</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="severity-info"
                          name="severity"
                          checked={selectedSeverity === 'info'}
                          onChange={() => setSelectedSeverity('info')}
                          className="text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <label htmlFor="severity-info" className="text-white text-sm">Info Only</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="severity-warning"
                          name="severity"
                          checked={selectedSeverity === 'warning'}
                          onChange={() => setSelectedSeverity('warning')}
                          className="text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <label htmlFor="severity-warning" className="text-white text-sm">Warnings Only</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="radio"
                          id="severity-error"
                          name="severity"
                          checked={selectedSeverity === 'error'}
                          onChange={() => setSelectedSeverity('error')}
                          className="text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <label htmlFor="severity-error" className="text-white text-sm">Errors Only</label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Quick Filter Checkboxes */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Quick Filters</label>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="errors-only"
                          checked={showErrorsOnly}
                          onChange={() => {
                            setShowErrorsOnly(!showErrorsOnly);
                            // If enabling errors-only, ensure selected severity is 'all'
                            if (!showErrorsOnly) {
                              setSelectedSeverity('all');
                            }
                          }}
                          disabled={selectedSeverity !== 'all'}
                          className={`text-red-600 focus:ring-red-500 mr-2 ${selectedSeverity !== 'all' ? 'opacity-50' : ''}`}
                        />
                        <label 
                          htmlFor="errors-only" 
                          className={`text-white text-sm ${selectedSeverity !== 'all' ? 'opacity-50' : ''}`}
                        >
                          Show Errors
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="warnings-only"
                          checked={showWarningsOnly}
                          onChange={() => {
                            setShowWarningsOnly(!showWarningsOnly);
                            // If enabling warnings-only, ensure selected severity is 'all'
                            if (!showWarningsOnly) {
                              setSelectedSeverity('all');
                            }
                          }}
                          disabled={selectedSeverity !== 'all'}
                          className={`text-yellow-600 focus:ring-yellow-500 mr-2 ${selectedSeverity !== 'all' ? 'opacity-50' : ''}`}
                        />
                        <label 
                          htmlFor="warnings-only" 
                          className={`text-white text-sm ${selectedSeverity !== 'all' ? 'opacity-50' : ''}`}
                        >
                          Show Warnings
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="remove-duplicates"
                          checked={removeDuplicates}
                          onChange={() => setRemoveDuplicates(!removeDuplicates)}
                          className="text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <label htmlFor="remove-duplicates" className="text-white text-sm">Remove Duplicates</label>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="disable-date-filters"
                          checked={disableDateFilter}
                          onChange={(e) => {
                            setDisableDateFilter(e.target.checked);
                            if (e.target.checked) {
                              setDatePreset('all');
                            } else {
                              // Set back to default (Last 7 days)
                              setDatePreset('7d');
                            }
                          }}
                          className="text-blue-600 focus:ring-blue-500 mr-2"
                        />
                        <label htmlFor="disable-date-filters" className="text-white text-sm">
                          Disable Date Filtering
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  {/* Log Streams Filter (if there are multiple streams) */}
                  {logStreams.length > 1 && (
                    <div className="col-span-full">
                      <label className="text-sm font-medium text-slate-300 block mb-2">
                        Log Streams ({logStreams.length})
                      </label>
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-slate-600 rounded-lg">
                        {logStreams.map(stream => (
                          <button
                            key={stream}
                            onClick={() => toggleLogStream(stream)}
                            className={`
                              px-3 py-1 text-xs rounded-full
                              ${selectedLogStreams.includes(stream)
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                              }
                            `}
                          >
                            {stream}
                          </button>
                        ))}
                      </div>
                      {logStreams.length > 10 && (
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={() => setSelectedLogStreams([])}
                            className="text-xs text-slate-400 hover:text-white"
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error Analysis Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Error Type Breakdown */}
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-red-400" />
                    <h2 className="text-lg font-medium">Error Types</h2>
                  </div>
                </div>
                
                {detectErrorTypes.length === 0 ? (
                  <p className="text-slate-400 text-center py-6">No errors detected</p>
                ) : (
                  <div className="space-y-3">
                    {detectErrorTypes.map((errorType, index) => (
                      <div 
                        key={errorType.name} 
                        className={`
                          flex items-center justify-between p-2 rounded-lg
                          ${selectedErrorType === errorType.name ? 'bg-slate-700' : 'hover:bg-slate-700/50'}
                          transition-colors cursor-pointer
                        `}
                        onClick={() => handleErrorTypeClick(errorType.name)}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ 
                              backgroundColor: ERROR_COLORS[index % ERROR_COLORS.length] 
                            }}
                          />
                          <span className="text-slate-200">{errorType.name}</span>
                          {selectedErrorType === errorType.name && (
                            <Eye className="w-4 h-4 text-blue-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-sm">
                            {errorType.count}
                          </span>
                          <div className="w-24 bg-slate-700 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full" 
                              style={{ 
                                width: `${Math.min((errorType.count / Math.max(...detectErrorTypes.map(e => e.count))) * 100, 100)}%`,
                                backgroundColor: ERROR_COLORS[index % ERROR_COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Error Sources */}
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="w-5 h-5 text-red-400" />
                  <h2 className="text-lg font-medium">Top Error Sources</h2>
                </div>
                
                {errorsByLogStream.length === 0 ? (
                  <p className="text-slate-400 text-center py-6">No errors found</p>
                ) : (
                  <div className="space-y-3">
                    {errorsByLogStream.map((item, index) => (
                      <div 
                        key={item.stream}
                        className="flex flex-col"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-slate-300 text-sm truncate" title={item.stream}>
                            {item.stream}
                          </span>
                          <span className="text-slate-400 text-xs">
                            {item.count} errors
                          </span>
                        </div>
                        <div className="w-full bg-slate-700 rounded-full h-2">
                          <div 
                            className="h-2 rounded-full bg-red-500" 
                            style={{ 
                              width: `${(item.count / Math.max(...errorsByLogStream.map(e => e.count))) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Error Messages - now clickable */}
              <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <h2 className="text-lg font-medium">Top Error Messages</h2>
                </div>
                
                {topErrorMessages.length === 0 ? (
                  <p className="text-slate-400 text-center py-6">No errors found</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {topErrorMessages.map((error, index) => (
                      <div 
                        key={index} 
                        className={`
                          bg-red-900/20 border border-red-500/50 rounded-lg p-3 
                          ${selectedErrorMessage === error.message ? 'ring-2 ring-red-500' : ''}
                          hover:bg-red-900/30 transition-colors cursor-pointer
                        `}
                        onClick={() => handleErrorMessageClick(error.message)}
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-red-300 text-sm font-medium flex-grow mr-2 truncate">
                            {error.message}
                            {selectedErrorMessage === error.message && (
                              <Eye className="w-4 h-4 text-red-400 inline ml-2" />
                            )}
                          </span>
                          <span className="bg-red-500/30 text-red-200 px-2 py-1 rounded-full text-xs flex-shrink-0">
                            {error.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Advanced Tools Section */}
            <div className="mb-6 bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-medium">Advanced Analysis Tools</h2>
                </div>
                <button
                  onClick={() => setShowTimeChart(!showTimeChart)}
                  className="text-slate-400 hover:text-white text-sm flex items-center gap-1"
                >
                  {showTimeChart ? 'Hide Charts' : 'Show Charts'}
                </button>
              </div>
              
              {showTimeChart && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Pattern Analysis Tool */}
                  <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                        <GitBranch className="w-5 h-5" />
                      </div>
                      <h3 className="text-white font-medium">Error Type Distribution</h3>
                    </div>
                  </div>
                
                  {/* Trend Detection Tool */}
                  <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                        <LineChartIcon className="w-5 h-5" />
                      </div>
                      <h3 className="text-white font-medium">Error Trends Over Time</h3>
                    </div>
                    
                    <div className="w-full h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={timeChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#aaa" 
                            fontSize={12}
                            tickFormatter={(value) => {
                              try {
                                const date = new Date(value);
                                return format(date, 'MMM dd');
                              } catch (e) {
                                return value;
                              }
                            }}
                          />
                          <YAxis stroke="#aaa" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '0.5rem', color: '#fff' }}
                            labelFormatter={(label) => {
                              try {
                                const date = new Date(label);
                                return format(date, 'MMMM d, yyyy');
                              } catch (e) {
                                return label;
                              }
                            }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="errors" name="Errors" stroke="#FF6384" strokeWidth={2} activeDot={{ r: 8 }} />
                          <Line type="monotone" dataKey="warnings" name="Warnings" stroke="#FFCE56" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Shared Analysis Tool */}
                <div 
                  className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:bg-slate-600 transition cursor-pointer"
                  onClick={() => {
                    const analysisData = {
                      timestamp: new Date().toISOString(),
                      logs: filteredLogs.length,
                      filters: {
                        dateRange: disableDateFilter ? 'All Time' : `${startDate} - ${endDate}`,
                        severity: selectedSeverity,
                        searchTerm: searchTerm || 'None',
                        errorType: selectedErrorType || 'None',
                        errorMessage: selectedErrorMessage || 'None'
                      }
                    };
                    
                    const blob = new Blob([JSON.stringify(analysisData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `log-analysis-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    alert('Analysis exported successfully! You can share this file with your team.');
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <h3 className="text-white font-medium">Export Snapshot</h3>
                  </div>
                  <p className="text-slate-300 text-sm">Save current analysis state as a shareable JSON snapshot for collaboration.</p>
                </div>
                
                {/* Timeline View Tool */}
                <div 
                  className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:bg-slate-600 transition cursor-pointer"
                  onClick={() => {
                    // Toggle between regular view and timeline view
                    const currentFilters = selectedSeverity !== 'all' || searchTerm || selectedErrorType || selectedErrorMessage;
                    
                    if (currentFilters) {
                      // Clear filters first
                      setSelectedSeverity('all');
                      setSearchTerm('');
                      setSelectedErrorType(null);
                      setSelectedErrorMessage(null);
                      setRemoveDuplicates(true);
                    } else {
                      // Sort by timestamp (oldest first) for timeline view
                      const sortedLogs = [...logs].sort((a, b) => {
                        const dateA = parseTimestamp(a.timestamp) || new Date(0);
                        const dateB = parseTimestamp(b.timestamp) || new Date(0);
                        return dateA.getTime() - dateB.getTime();
                      });
                      
                      setLogs(sortedLogs);
                      setFilteredLogs(sortedLogs);
                      setShowWarningsOnly(false);
                      setShowErrorsOnly(true);
                      setRemoveDuplicates(true);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <h3 className="text-white font-medium">Timeline View</h3>
                  </div>
                  <p className="text-slate-300 text-sm">Optimize the view to see errors in chronological order and identify sequences.</p>
                </div>
                
                {/* AI-Powered Insights Tool */}
                <div 
                  className="bg-slate-700 rounded-lg p-4 border border-slate-600 hover:bg-slate-600 transition cursor-pointer"
                  onClick={analyzeWithAI}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h3 className="text-white font-medium">Coming soon</h3>
                  </div>
                  <p className="text-slate-300 text-sm">Generate intelligent insights and root cause analysis using AI technologies.</p>
                </div>
              </div>
            </div>

            
            {/* Logs Viewer */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-medium">Log Viewer</h2>
                </div>
                <div className="text-sm text-slate-300">
                  Showing {paginatedLogs.length} of {filteredLogs.length} logs
                </div>
              </div>
              
              <LogViewer logs={prepareLogsForViewer(paginatedLogs)} />
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <select
                      value={logsPerPage}
                      onChange={(e) => setLogsPerPage(Number(e.target.value))}
                      className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-white text-sm"
                    >
                      {LOGS_PER_PAGE_OPTIONS.map(option => (
                        <option key={option} value={option}>
                          {option} per page
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-slate-400">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`
                        p-2 rounded-lg 
                        ${currentPage === 1 
                          ? 'text-slate-500 cursor-not-allowed' 
                          : 'text-white bg-slate-700 hover:bg-slate-600'
                        }
                      `}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`
                        p-2 rounded-lg 
                        ${currentPage === totalPages 
                          ? 'text-slate-500 cursor-not-allowed' 
                          : 'text-white bg-slate-700 hover:bg-slate-600'
                        }
                      `}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LogAnalysisPage;