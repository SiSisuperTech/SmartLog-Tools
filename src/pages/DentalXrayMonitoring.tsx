import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  X, 
  AlertCircle, 
  RefreshCw,
  Download,
  Sparkles,
  FileText,
  Camera,
  Database,
  Settings,
  Eye,
  EyeOff,
  Layers,
  Server,
  Calendar,
  GitBranch,
  Monitor,
  BarChart3,
  ArrowLeft,
  Users,
  HardDrive,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle
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

// Define types for logs and configuration
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
  dbConfig: {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  pmBridgePath: string;
  romexisRadioPath: string;
  isValid: boolean;
}

interface SessionInfo {
  id: string;
  type: string;
  startTime: string;
  username?: string;
  location?: string;
}

interface TreatmentInfo {
  timestamp: string;
  patientId: string;
  patientName: string;
  type: string;
}

interface DentalXrayDashboardProps {
  logs?: LogEntry[];
  onBackClick?: () => void;
}

const DentalXrayDashboard: React.FC<DentalXrayDashboardProps> = ({ 
  logs: propLogs, 
  onBackClick 
}) => {
  // Core state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dashboard specific state
  const [xrayConfig, setXrayConfig] = useState<XrayConfig | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [treatments, setTreatments] = useState<TreatmentInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationName, setLocationName] = useState<string>('');
  const [allisonVersion, setAllisonVersion] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'storage' | 'network'>('overview');
  
  // Feature toggles
  const [showAiAnalysis, setShowAiAnalysis] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('all');
  const [showDetails, setShowDetails] = useState(false);
  
  // Analysis metrics
  const [panoCount, setPanoCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  
  // Status and historical data
  const [systemStatus, setSystemStatus] = useState<'online' | 'offline' | 'warning' | 'error'>('online');
  const [dailyStats, setDailyStats] = useState<{date: string, panos: number, errors: number}[]>([]);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Use logs from props if provided, otherwise use mock data
  useEffect(() => {
    if (propLogs && propLogs.length > 0) {
      setLogs(propLogs);
      setFilteredLogs(propLogs);
      extractSystemInfo(propLogs);
      setIsLoading(false);
    } else {
      loadMockData();
    }
  }, [propLogs]);

  // Load mock data for development/demonstration
  const loadMockData = () => {
    setIsLoading(true);
    
    // Mock logs for development
    const mockLogs: LogEntry[] = [
      {
        timestamp: '2025-02-27T10:15:30',
        message: 'System initialized',
        severity: 'info'
      },
      {
        timestamp: '2025-02-27T10:15:35',
        message: 'Connected to RAYOS session',
        severity: 'info'
      },
      {
        timestamp: '2025-02-27T10:16:02',
        message: 'createTreatment: Treatment created successfully for He**** AR**',
        severity: 'info'
      },
      {
        timestamp: '2025-02-27T10:18:15',
        message: 'Configuration loaded: {"storeXraySoftware":{"name":"romexis","version":"5"},"conf":{"dbConfig":{"server":"localhost\\\\ROMEXIS","port":1433,"database":"Romexis_db","password":"romexis","user":"romexis","ssl":true},"pmBridgePath":"C:\\\\Program Files\\\\Planmeca\\\\Romexis\\\\pmbridge\\\\Program\\\\DxStartW.exe","romexisRadioPath":"E:\\\\romexis_images"},"isConfigurationValid":true}',
        severity: 'info'
      },
      {
        timestamp: '2025-02-27T10:23:45',
        message: 'createTreatment: Treatment created successfully for Jo**** SM**',
        severity: 'info'
      },
      {
        timestamp: '2025-02-27T10:30:12',
        message: 'Database connection established',
        severity: 'info'
      },
      {
        timestamp: '2025-02-27T11:15:30',
        message: 'createTreatment: Treatment created successfully for Ma**** WI**',
        severity: 'info'
      },
      {
        timestamp: '2025-02-27T11:42:15',
        message: 'Error connecting to DICOM server',
        severity: 'error'
      },
      {
        timestamp: '2025-02-27T12:05:22',
        message: 'createTreatment: Treatment created successfully for Sa**** JO**',
        severity: 'info'
      },
      {
        timestamp: '2025-02-27T12:33:45',
        message: 'Low disk space warning',
        severity: 'warning'
      }
    ];
    
    // Set timeout to simulate loading
    setTimeout(() => {
      setLogs(mockLogs);
      setFilteredLogs(mockLogs);
      
      // Extract system information from logs
      extractSystemInfo(mockLogs);
      
      // Set default location and version
      setLocationName('North Clinic (ID: 12345)');
      setAllisonVersion('3.5.2');
      
      setIsLoading(false);
    }, 1000);
  };

  // Extract system information from logs
  const extractSystemInfo = (logs: LogEntry[]) => {
    // Extract X-ray configuration
    const configLog = logs.find(log => log.message.includes('Configuration loaded'));
    
    if (configLog) {
      try {
        const configStart = configLog.message.indexOf('{');
        const configData = JSON.parse(configLog.message.slice(configStart));
        
        setXrayConfig({
          name: configData.storeXraySoftware.name,
          version: configData.storeXraySoftware.version,
          dbConfig: configData.conf.dbConfig,
          pmBridgePath: configData.conf.pmBridgePath,
          romexisRadioPath: configData.conf.romexisRadioPath,
          isValid: configData.isConfigurationValid
        });
      } catch (error) {
        console.error('Error parsing configuration:', error);
      }
    }
    
    // Extract sessions
    const sessionLogs = logs.filter(log => log.message.includes('RAYOS session'));
    const extractedSessions = sessionLogs.map((log, index) => ({
      id: `session-${index}`,
      type: 'RAYOS',
      startTime: log.timestamp,
      username: 'Admin', // Default, would be extracted from actual logs
      location: locationName
    }));
    setSessions(extractedSessions);
    setSessionCount(extractedSessions.length);
    
    // Extract treatments (panoramic X-rays)
    const treatmentLogs = logs.filter(log => log.message.includes('createTreatment'));
    const extractedTreatments = treatmentLogs.map((log, index) => {
      // Extract patient name from message (format: "createTreatment: Treatment created successfully for Pa**** NA**")
      const messageMatch = log.message.match(/for\s+([A-Za-z*]+\s+[A-Za-z*]+)/);
      const patientName = messageMatch ? messageMatch[1] : 'Unknown Patient';
      
      return {
        timestamp: log.timestamp,
        patientId: `patient-${index}`,
        patientName,
        type: 'Panoramic X-ray'
      };
    });
    setTreatments(extractedTreatments);
    setPanoCount(extractedTreatments.length);
    
    // Count errors and warnings
    setErrorCount(logs.filter(log => log.severity === 'error').length);
    setWarningCount(logs.filter(log => log.severity === 'warning').length);
    
    // Set system status based on errors/warnings
    if (errorCount > 0) {
      setSystemStatus('error');
    } else if (warningCount > 0) {
      setSystemStatus('warning');
    } else {
      setSystemStatus('online');
    }
    
    // Generate daily stats
    const today = new Date();
    const dailyStatsMap: Record<string, {panos: number, errors: number}> = {};
    
    // Initialize the last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      dailyStatsMap[dateKey] = { panos: 0, errors: 0 };
    }
    
    // Add actual data from logs
    logs.forEach(log => {
      try {
        const date = new Date(log.timestamp);
        const dateKey = date.toISOString().split('T')[0];
        
        // Only consider last 7 days
        if (dailyStatsMap[dateKey]) {
          if (log.message.includes('createTreatment')) {
            dailyStatsMap[dateKey].panos++;
          }
          if (log.severity === 'error') {
            dailyStatsMap[dateKey].errors++;
          }
        }
      } catch (e) {
        // Skip invalid dates
      }
    });
    
    // Convert to array for chart
    const dailyStatsArray = Object.entries(dailyStatsMap).map(([date, stats]) => ({
      date,
      ...stats
    }));
    
    setDailyStats(dailyStatsArray);
  };

  // Filter logs based on search and filters
  useEffect(() => {
    if (logs.length === 0) return;
    
    let result = [...logs];
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(log => 
        log.message.toLowerCase().includes(term) || 
        log.timestamp.toLowerCase().includes(term)
      );
    }
    
    // Apply errors only filter
    if (showErrorsOnly) {
      result = result.filter(log => log.severity === 'error');
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
    
    setFilteredLogs(result);
  }, [logs, searchTerm, showErrorsOnly, timeRange]);

  // Create snapshot function
  const createSnapshot = () => {
    try {
      setSnapshotStatus('Creating snapshot...');
      
      // Prepare snapshot data
      const snapshot = {
        timestamp: new Date().toISOString(),
        location: locationName,
        allisonVersion,
        xrayConfig,
        stats: {
          panoCount,
          errorCount,
          warningCount,
          sessionCount
        },
        sessions,
        treatments,
        recentLogs: filteredLogs.slice(0, 10) // Include first 10 logs
      };
      
      // Create and download JSON file
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dental-xray-snapshot-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSnapshotStatus('Snapshot created successfully!');
      setTimeout(() => setSnapshotStatus(null), 3000);
      
    } catch (error) {
      console.error('Error creating snapshot:', error);
      setSnapshotStatus('Error creating snapshot: ' + (error instanceof Error ? error.message : String(error)));
      setTimeout(() => setSnapshotStatus(null), 5000);
    }
  };

  // Run advanced analysis
  const runAdvancedAnalysis = () => {
    setIsLoading(true);
    
    // In a real app, this would call an API endpoint
    setTimeout(() => {
      // Sample analysis results
      const analysisResult = {
        systemHealth: errorCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy',
        recommendations: [
          'Regular backups of patient data recommended',
          'Update X-ray software to latest version',
          'Check disk space on main server'
        ],
        errorPatterns: [
          { type: 'Connection', count: errorCount > 0 ? 1 : 0 },
          { type: 'Database', count: 0 },
          { type: 'Storage', count: warningCount > 0 ? 1 : 0 }
        ],
        performance: {
          responseTime: '120ms',
          databaseQueries: '250/hr',
          imageProcessingTime: '3.2s'
        }
      };
      
      // Display results in an alert dialog
      alert(
        `Advanced Analysis Results:\n\n` +
        `System Health: ${analysisResult.systemHealth}\n\n` +
        `Recommendations:\n${analysisResult.recommendations.join('\n')}\n\n` +
        `Performance Metrics:\n` +
        `- Response Time: ${analysisResult.performance.responseTime}\n` +
        `- Database Queries: ${analysisResult.performance.databaseQueries}\n` +
        `- Image Processing: ${analysisResult.performance.imageProcessingTime}`
      );
      
      setIsLoading(false);
    }, 2000);
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return timestamp;
    }
  };

  // Calculate performance metrics
  const performanceMetrics = useMemo(() => {
    // Calculate success rate
    const attempts = logs.filter(log => log.message.includes('Sending data to API for')).length;
    const successes = logs.filter(log => log.message.includes('Treatment created successfully')).length;
    const successRate = attempts > 0 ? successes / attempts : 1;
    
    // Calculate avg processing time (mock data for demo)
    const avgProcessingTime = 7.2;
    
    // Calculate average file size from logs if available
    let totalFileSize = 0;
    let fileCount = 0;
    
    logs.forEach(log => {
      if (log.message.includes('uploaded file') && log.message.includes('size:')) {
        const sizeMatch = log.message.match(/size:\s+(\d+)/);
        if (sizeMatch) {
          const size = parseInt(sizeMatch[1], 10) / (1024 * 1024); // Convert to MB
          totalFileSize += size;
          fileCount++;
        }
      }
    });
    
    const avgFileSize = fileCount > 0 ? totalFileSize / fileCount : 7.5; // Default to 7.5MB if no data
    
    return {
      successRate,
      avgProcessingTime,
      avgFileSize
    };
  }, [logs]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <h2 className="text-xl text-white font-medium">Loading Dashboard...</h2>
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
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold flex items-center">
          <Monitor className="w-5 h-5 mr-2 text-blue-400" />
          Dental X-ray System Dashboard
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
        </h2>
        
        {onBackClick && (
          <button
            onClick={onBackClick}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Log View
          </button>
        )}
      </div>
      
      {/* Header Info and Controls */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2 flex items-center">
            <Settings className="w-4 h-4 mr-2 text-blue-400" />
            Location Information
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Location:</span>
              <span className="font-medium">{locationName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Allison Version:</span>
              <span className="font-medium">{allisonVersion}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2 flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-blue-400" />
            Time Range
          </h3>
          <select 
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="w-full bg-slate-600 border border-slate-500 rounded-lg p-2 text-white"
          >
            <option value="all">All Time</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
        
        <div className="bg-slate-700/50 rounded-lg p-4">
          <h3 className="text-lg font-medium mb-2 flex items-center">
            <Download className="w-4 h-4 mr-2 text-blue-400" />
            Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={createSnapshot}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              <Download className="w-4 h-4 inline mr-1" />
              Snapshot
            </button>
            <button
              onClick={runAdvancedAnalysis}
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
            >
              <Sparkles className="w-4 h-4 inline mr-1" />
              Analysis
            </button>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex mb-6 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 ${
            activeTab === 'overview' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          System Overview
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 ${
            activeTab === 'performance' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Performance
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`px-4 py-2 ${
            activeTab === 'storage' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Storage
        </button>
        <button
          onClick={() => setActiveTab('network')}
          className={`px-4 py-2 ${
            activeTab === 'network' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Network
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* System Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div className="bg-blue-900/20 rounded-lg p-4">
    <div className="flex items-center gap-2 text-blue-400 mb-2">
      <Camera className="w-4 h-4" />
      <span className="text-sm font-medium">X-rays Taken</span>
    </div>
    <div className="text-2xl font-bold">{panoCount}</div>
    <div className="text-xs text-blue-300/70 mt-1">
      {timeRange === 'all' ? 'All time' : `Last ${timeRange}`}
    </div>
  </div>
  
  <div className="bg-purple-900/20 rounded-lg p-4">
    <div className="flex items-center gap-2 text-purple-400 mb-2">
      <Users className="w-4 h-4" />
      <span className="text-sm font-medium">Patients</span>
    </div>
    <div className="text-2xl font-bold">{treatments.length}</div>
    <div className="text-xs text-purple-300/70 mt-1">
      Unique patients processed
    </div>
  </div>
  
  <div className="bg-red-900/20 rounded-lg p-4">
    <div className="flex items-center gap-2 text-red-400 mb-2">
      <Activity className="w-4 h-4" />
      <span className="text-sm font-medium">Errors</span>
    </div>
    <div className="text-2xl font-bold">{errorCount}</div>
    <div className="text-xs text-red-300/70 mt-1">
      {warningCount} warnings
    </div>
  </div>
  
  <div className="bg-amber-900/20 rounded-lg p-4">
    <div className="flex items-center gap-2 text-amber-400 mb-2">
      <Calendar className="w-4 h-4" />
      <span className="text-sm font-medium">Last Active</span>
    </div>
    <div className="text-md font-bold">
      {logs.length > 0 
        ? formatTimestamp(logs.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0].timestamp)
        : 'N/A'
      }
    </div>
  </div>
</div>
          
          {/* System Configuration */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium flex items-center">
                <Server className="w-4 h-4 mr-2 text-blue-400" />
                System Configuration
              </h3>
              
              <button 
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-slate-400 hover:text-white"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Software Info */}
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4" />
                  X-ray Software
                </h4>
                
                {xrayConfig ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name:</span>
                      <span className="text-white font-medium capitalize">{xrayConfig.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Version:</span>
                      <span className="text-white font-medium">{xrayConfig.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className={`font-medium ${xrayConfig.isValid ? 'text-green-500' : 'text-red-500'}`}>
                        {xrayConfig.isValid ? 'Valid Configuration' : 'Invalid Configuration'}
                      </span>
                    </div>
                    {showDetails && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <div className="text-xs text-slate-400 mb-1">Bridge Path:</div>
                        <div className="bg-slate-700/50 p-1 rounded text-xs overflow-x-auto whitespace-nowrap">
                          {xrayConfig.pmBridgePath}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Software information not available</p>
                )}
              </div>
              {/* Add this section to the System tab */}
<div className="bg-slate-700/50 rounded-lg p-4">
  <h3 className="text-lg font-medium mb-3">Complete Configuration</h3>
  
  {xrayConfig ? (
    <div className="space-y-3">
      {/* Configuration Validity Status */}
      <div className={`p-3 rounded-lg border ${xrayConfig.isValid ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'}`}>
        <div className="flex items-center gap-2">
          {xrayConfig.isValid 
            ? <CheckCircle className="w-5 h-5 text-green-500" /> 
            : <AlertTriangle className="w-5 h-5 text-red-500" />
          }
          <span className="font-medium">
            Configuration is {xrayConfig.isValid ? 'valid' : 'invalid'}
          </span>
        </div>
        <div className="mt-1 text-sm">
          Last updated: {formatTimestamp(logs.find(log => log.message.includes('Configuration loaded'))?.timestamp || '')}
        </div>
      </div>
      
      {/* Full Configuration JSON */}
      <div className="mt-3">
        <div className="text-slate-300 font-medium mb-2">Raw Configuration Data:</div>
        <pre className="bg-slate-800 p-3 rounded-lg overflow-x-auto text-xs">
          {JSON.stringify(xrayConfig, null, 2)}
        </pre>
      </div>
    </div>
  ) : (
    <p className="text-slate-400 text-sm py-2">Configuration information not available</p>
  )}
</div>

{/* Recent Logs Section */}
<div className="bg-slate-700/50 rounded-lg p-4 mt-6">
  <h3 className="text-lg font-medium mb-3">Recent System Logs</h3>
  
  <div className="space-y-2 max-h-96 overflow-y-auto">
    {logs.slice(0, 10).map((log, index) => (
      <div 
        key={index} 
        className={`p-2 rounded-lg ${
          log.severity === 'error' ? 'bg-red-900/20 border border-red-500/30' : 
          log.severity === 'warning' ? 'bg-yellow-900/20 border border-yellow-500/30' :
          'bg-slate-700/50 border border-slate-600/30'
        }`}
      >
        <div className="text-xs text-slate-400 mb-1">{formatTimestamp(log.timestamp)}</div>
        <div className="text-sm">{log.message}</div>
      </div>
    ))}
  </div>
</div>
              {/* Database Info */}
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4" />
                  Database Configuration
                </h4>
                
                {xrayConfig?.dbConfig ? (
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
                      <span className="text-slate-400">SSL:</span>
                      <span className="text-white">{xrayConfig.dbConfig.ssl ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    {showDetails && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Port:</span>
                          <span className="text-white">{xrayConfig.dbConfig.port}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">User:</span>
                          <span className="text-white">{xrayConfig.dbConfig.user}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">Database information not available</p>
                )}
              </div>
            </div>
          </div>
          
          {/* X-ray Activity Chart */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">X-ray Activity (7 Days)</h3>
            
            <div className="h-64">
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
          
          {/* Recent Treatments */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <Camera className="w-4 h-4 mr-2 text-blue-400" />
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
                No treatments found
              </div>
            )}
          </div>
        </div>
      )}
      
      {activeTab === 'performance' && (
        <div className="space-y-6">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">Processing Performance</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-teal-900/20 rounded-lg p-4">
                <div className="text-teal-400 text-sm font-medium mb-2">Average Processing Time</div>
                <div className="text-2xl font-bold">
                  {performanceMetrics.avgProcessingTime.toFixed(1)}s
                </div>
                <div className="mt-2 text-xs text-teal-300/70">
                  Time from detection to successful upload
                </div>
              </div>
              
              <div className="bg-blue-900/20 rounded-lg p-4">
                <div className="text-blue-400 text-sm font-medium mb-2">Success Rate</div>
                <div className="text-2xl font-bold">
                  {(performanceMetrics.successRate * 100).toFixed(1)}%
                </div>
                <div className="mt-2 text-xs text-blue-300/70">
                  X-ray processing completion rate
                </div>
              </div>
              
              <div className="bg-purple-900/20 rounded-lg p-4">
                <div className="text-purple-400 text-sm font-medium mb-2">Average File Size</div>
                <div className="text-2xl font-bold">
                  {performanceMetrics.avgFileSize.toFixed(1)} MB
                </div>
                <div className="mt-2 text-xs text-purple-300/70">
                  Average X-ray image size
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">System Activity</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium mb-2">Authentication</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sessions:</span>
                    <span className="font-medium">{sessionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Token Refreshes:</span>
                    <span className="font-medium">
                      {logs.filter(log => log.message.includes('Token refreshed')).length}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium mb-2">System Status</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Restarts:</span>
                    <span className="font-medium">
                      {logs.filter(log => log.message.includes('Restarting app')).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Errors:</span>
                    <span className="font-medium">{errorCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">Performance Assessment</h3>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Processing Speed</span>
                  <span className="text-sm text-blue-400">
                    {performanceMetrics.avgProcessingTime < 8 ? 'Good' : 
                     performanceMetrics.avgProcessingTime < 15 ? 'Average' : 'Slow'}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-blue-500" 
                    style={{ 
                      width: `${Math.min(100, 100 - (performanceMetrics.avgProcessingTime / 20 * 100))}%` 
                    }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Success Rate</span>
                  <span className="text-sm text-green-400">
                    {performanceMetrics.successRate >= 0.98 ? 'Excellent' :
                     performanceMetrics.successRate >= 0.9 ? 'Good' :
                     performanceMetrics.successRate >= 0.8 ? 'Average' : 'Poor'}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-green-500" 
                    style={{ width: `${performanceMetrics.successRate * 100}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">System Health</span>
                  <span className="text-sm text-purple-400">
                    {errorCount === 0 ? 'Optimal' :
                     errorCount < 5 ? 'Good' :
                     errorCount < 10 ? 'Average' : 'Needs Attention'}
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full bg-purple-500" 
                    style={{ 
                      width: `${Math.max(0, 100 - (errorCount * 5))}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'storage' && (
        <div className="space-y-6">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">File Storage Analysis</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-900/20 rounded-lg p-4">
                <div className="text-blue-400 text-sm font-medium mb-2">Total X-rays</div>
                <div className="text-2xl font-bold">{panoCount}</div>
                <div className="mt-2 text-xs text-blue-300/70">
                  X-rays stored in the system
                </div>
              </div>
              
              <div className="bg-teal-900/20 rounded-lg p-4">
                <div className="text-teal-400 text-sm font-medium mb-2">Average File Size</div>
                <div className="text-2xl font-bold">
                  {performanceMetrics.avgFileSize.toFixed(1)} MB
                </div>
                <div className="mt-2 text-xs text-teal-300/70">
                  Average DICOM image size
                </div>
              </div>
              
              <div className="bg-amber-900/20 rounded-lg p-4">
                <div className="text-amber-400 text-sm font-medium mb-2">Estimated Total Storage</div>
                <div className="text-2xl font-bold">
                  {((panoCount * performanceMetrics.avgFileSize) / 1024).toFixed(2)} GB
                </div>
                <div className="mt-2 text-xs text-amber-300/70">
                  Based on average file size
                </div>
              </div>
            </div>
          </div>
          
          {/* Storage Paths */}
          {xrayConfig && (
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h3 className="text-lg font-medium mb-3">Storage Paths</h3>
              
              <div className="space-y-3">
                {/* PM Bridge Path */}
                <div className="bg-slate-800 rounded-lg p-3">
                  <h4 className="text-blue-400 font-medium mb-2">PM Bridge Path</h4>
                  <div className="bg-slate-700/30 p-2 rounded text-sm font-mono overflow-x-auto">
                    {xrayConfig.pmBridgePath}
                  </div>
                </div>
                
                {/* Images Path */}
                <div className="bg-slate-800 rounded-lg p-3">
                  <h4 className="text-blue-400 font-medium mb-2">Images Path</h4>
                  <div className="bg-slate-700/30 p-2 rounded text-sm font-mono overflow-x-auto">
                    {xrayConfig.romexisRadioPath}
                  </div>
                </div>
                
                {/* Storage Recommendation */}
                <div className="bg-slate-800 rounded-lg p-3">
                  <h4 className="text-yellow-400 font-medium mb-2 flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Storage Recommendation
                  </h4>
                  <p className="text-sm">
                    Based on your current usage patterns, you should ensure at least 
                    {' '}{((panoCount * performanceMetrics.avgFileSize * 2) / 1024).toFixed(2)} GB 
                    of free space to accommodate future X-rays.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* File Size Distribution */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">File Size Distribution</h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={[
                    { size: '< 5 MB', count: 2 },
                    { size: '5-7 MB', count: 5 },
                    { size: '7-8 MB', count: 8 },
                    { size: '8-10 MB', count: 3 },
                    { size: '> 10 MB', count: 0 }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="size" stroke="#999" />
                  <YAxis stroke="#999" />
                  <Tooltip formatter={(value) => [value, 'Files']} />
                  <Bar dataKey="count" name="Files" fill="#36A2EB" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'network' && (
        <div className="space-y-6">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">Network Status</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium mb-2">Connection Status</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                    <span>Database Connection: Online</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                    <span>DICOM Server Connection: Online</span>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                    <span>Cloud Storage Connection: Online</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium mb-2">Connection Metrics</h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg. Response Time:</span>
                    <span className="font-medium">120ms</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-400">Upload Bandwidth:</span>
                    <span className="font-medium">15 MB/s</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-400">Network Errors:</span>
                    <span className="font-medium">{logs.filter(log => log.message.toLowerCase().includes('network') && log.severity === 'error').length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Network Activity Chart */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">Network Activity</h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={dailyStats.map(item => ({
                    date: item.date,
                    uploads: item.panos,
                    downloads: Math.floor(item.panos * 0.7)
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#999"
                    tickFormatter={(value) => {
                      const parts = value.split('-');
                      return `${parts[1]}/${parts[2]}`;
                    }}
                  />
                  <YAxis stroke="#999" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '0.375rem'
                    }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="uploads" 
                    name="Uploads" 
                    stroke="#8884d8" 
                    fill="#8884d8"
                    fillOpacity={0.3} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="downloads" 
                    name="Downloads" 
                    stroke="#82ca9d" 
                    fill="#82ca9d"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* API Endpoints */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">API Endpoints</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-600">
                    <th className="pb-2 text-slate-400 font-medium">Endpoint</th>
                    <th className="pb-2 text-slate-400 font-medium">Status</th>
                    <th className="pb-2 text-slate-400 font-medium">Response Time</th>
                    <th className="pb-2 text-slate-400 font-medium">Last Call</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-2">/api/uploadFile</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 bg-green-900/30 text-green-400 rounded-full text-xs">
                        Online
                      </span>
                    </td>
                    <td className="py-2">238ms</td>
                    <td className="py-2">{logs.find(log => log.message.includes('uploaded file'))?.timestamp ? formatTimestamp(logs.find(log => log.message.includes('uploaded file'))!.timestamp) : 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-2">/api/createTreatment</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 bg-green-900/30 text-green-400 rounded-full text-xs">
                        Online
                      </span>
                    </td>
                    <td className="py-2">157ms</td>
                    <td className="py-2">{logs.find(log => log.message.includes('Treatment created successfully'))?.timestamp ? formatTimestamp(logs.find(log => log.message.includes('Treatment created successfully'))!.timestamp) : 'N/A'}</td>
                  </tr>
                  <tr className="border-b border-slate-700 hover:bg-slate-700/30">
                    <td className="py-2">/api/auth</td>
                    <td className="py-2">
                      <span className="px-2 py-0.5 bg-green-900/30 text-green-400 rounded-full text-xs">
                        Online
                      </span>
                    </td>
                    <td className="py-2">82ms</td>
                    <td className="py-2">{logs.find(log => log.message.includes('Token refreshed'))?.timestamp ? formatTimestamp(logs.find(log => log.message.includes('Token refreshed'))!.timestamp) : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      
      {/* Status message for snapshot */}
      {snapshotStatus && (
        <div className={`mt-6 px-4 py-2 rounded-lg ${
          snapshotStatus.includes('Error') 
            ? 'bg-red-900/30 border border-red-700' 
            : 'bg-blue-900/30 border border-blue-700'
        }`}>
          {snapshotStatus}
        </div>
      )}
    </div>
  );
};

export default DentalXrayDashboard;