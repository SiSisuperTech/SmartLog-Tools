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
  Monitor
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
  Pie
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

const DentalXrayDashboard: React.FC = () => {
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
  
  // Feature toggles
  const [showAiAnalysis, setShowAiAnalysis] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  
  // Analysis metrics
  const [panoCount, setPanoCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  
  // Status and historical data
  const [systemStatus, setSystemStatus] = useState<'online' | 'offline' | 'warning' | 'error'>('online');
  const [dailyStats, setDailyStats] = useState<{date: string, panos: number, errors: number}[]>([]);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);

  // Mock data for initial development
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

  // Load logs and extract data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      try {
        // In a real app, this would fetch from an API
        // const response = await fetch('/api/logs');
        // const data = await response.json();
        
        // Using mock data for now
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
        
      } catch (err) {
        setError('Failed to load logs: ' + (err instanceof Error ? err.message : String(err)));
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

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
    
    // Generate mock daily stats
    const today = new Date();
    const mockDailyStats = [
      { date: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], panos: 12, errors: 0 },
      { date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], panos: 15, errors: 1 },
      { date: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], panos: 10, errors: 0 },
      { date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], panos: 14, errors: 2 },
      { date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], panos: 18, errors: 0 },
      { date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], panos: 16, errors: 1 },
      { date: today.toISOString().split('T')[0], panos: panoCount, errors: errorCount }
    ];
    setDailyStats(mockDailyStats);
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
    
    setFilteredLogs(result);
  }, [logs, searchTerm, showErrorsOnly]);

  // Create snapshot function - Fixed implementation
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

  // Run advanced analysis - Fixed implementation
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
      
      // Display results (in a real app, this would update UI components)
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
    <div className="min-h-screen bg-slate-900 p-4 text-white">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center">
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
            <div className="text-slate-300 mt-1">
              <div className="flex items-center">
                <span className="font-medium mr-2">Location:</span>
                <span>{locationName}</span>
              </div>
              <div className="flex items-center mt-1">
                <span className="font-medium mr-2">Allison Version:</span>
                <span>{allisonVersion}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mt-4 md:mt-0">
            <button
              onClick={createSnapshot}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Snapshot
            </button>
            
            <button
              onClick={() => setShowAiAnalysis(!showAiAnalysis)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center"
            >
              {showAiAnalysis ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide AI Analysis
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Show AI Analysis
                </>
              )}
            </button>
            
            <button
              onClick={runAdvancedAnalysis}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition flex items-center"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Advanced Analysis
            </button>
          </div>
        </div>
        
        {/* Search bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-grow max-w-2xl">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            onClick={() => setShowErrorsOnly(!showErrorsOnly)}
            className={`px-3 py-2 rounded-lg border ${
              showErrorsOnly 
                ? 'bg-red-600 border-red-500 text-white' 
                : 'bg-slate-800 border-slate-700 text-slate-300'
            } transition flex items-center`}
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Errors Only
          </button>
        </div>
        
        {snapshotStatus && (
          <div className={`mt-4 px-4 py-2 rounded-lg ${
            snapshotStatus.includes('Error') 
              ? 'bg-red-900/30 border border-red-700' 
              : 'bg-blue-900/30 border border-blue-700'
          }`}>
            {snapshotStatus}
          </div>
        )}
      </header>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* X-ray Software Info */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Camera className="w-5 h-5 mr-2 text-blue-400" />
            X-ray Software
          </h2>
          
          {xrayConfig ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-2 bg-slate-700/50 rounded-lg">
                <span className="text-slate-300">Software Name</span>
                <span className="font-medium capitalize">{xrayConfig.name}</span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-slate-700/50 rounded-lg">
                <span className="text-slate-300">Version</span>
                <span className="font-medium">{xrayConfig.version}</span>
              </div>
              
              <div className="flex justify-between items-center p-2 bg-slate-700/50 rounded-lg">
                <span className="text-slate-300">Status</span>
                <span className={`font-medium ${xrayConfig.isValid ? 'text-green-500' : 'text-red-500'}`}>
                  {xrayConfig.isValid ? 'Valid Configuration' : 'Invalid Configuration'}
                </span>
              </div>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2 flex items-center">
                  <Database className="w-4 h-4 mr-2 text-blue-400" />
                  Database Configuration
                </h3>
                
                <div className="p-3 bg-slate-700/30 rounded-lg">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-slate-400">Server</div>
                    <div className="col-span-2 font-mono text-xs overflow-x-auto">{xrayConfig.dbConfig.server}</div>
                    
                    <div className="text-slate-400">Database</div>
                    <div className="col-span-2 font-mono text-xs">{xrayConfig.dbConfig.database}</div>
                    
                    <div className="text-slate-400">Port</div>
                    <div className="col-span-2 font-mono text-xs">{xrayConfig.dbConfig.port}</div>
                    
                    <div className="text-slate-400">SSL</div>
                    <div className="col-span-2 font-mono text-xs">{xrayConfig.dbConfig.ssl ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Paths</h3>
                
                <div className="space-y-2">
                  <div>
                    <div className="text-sm text-slate-400">PM Bridge Path</div>
                    <div className="font-mono text-xs bg-slate-700/30 p-2 rounded-lg overflow-x-auto">
                      {xrayConfig.pmBridgePath}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-slate-400">Images Path</div>
                    <div className="font-mono text-xs bg-slate-700/30 p-2 rounded-lg overflow-x-auto">
                      {xrayConfig.romexisRadioPath}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No X-ray software configuration found</p>
            </div>
          )}
        </div>
        
        {/* Sessions and Activity */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Monitor className="w-5 h-5 mr-2 text-blue-400" />
            Sessions & Activity
          </h2>
          
          <div className="mb-4">
            <h3 className="font-medium text-lg mb-2">Active Sessions ({sessions.length})</h3>
            
            {sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions.map(session => (
                  <div key={session.id} className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex justify-between">
                      <span className="font-medium">{session.type} Session</span>
                      <span className="text-green-400 text-sm">Active</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-slate-400">Started</span>
                      <span>{formatTimestamp(session.startTime)}</span>
                    </div>
                    {session.username && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-slate-400">User</span>
                        <span>{session.username}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 bg-slate-700/30 rounded-lg">
                No active sessions found
              </div>
            )}
          </div>
          
          <div>
            <h3 className="font-medium text-lg mb-2">Recent Treatments ({treatments.length})</h3>
            
            {treatments.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {treatments.map((treatment, index) => (
                  <div key={index} className="bg-blue-900/20 border border-blue-800/30 rounded-lg p-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-300">{treatment.patientName}</span>
                      <span className="text-slate-400 text-xs">{formatTimestamp(treatment.timestamp)}</span>
                    </div>
                    <div className="flex items-center mt-1">
                      <span className="bg-blue-600/30 text-blue-200 px-2 py-0.5 rounded-full text-xs">
                        {treatment.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 bg-slate-700/30 rounded-lg">
                No treatments found
              </div>
            )}
          </div>
        </div>
        
        {/* System Metrics */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <GitBranch className="w-5 h-5 mr-2 text-blue-400" />
            System Metrics
          </h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-400">{panoCount}</div>
              <div className="text-blue-200 text-sm mt-1">Panoramic X-rays</div>
            </div>
            
            <div className="bg-red-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-400">{errorCount}</div>
              <div className="text-red-200 text-sm mt-1">Errors</div>
            </div>
            
            <div className="bg-yellow-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">{warningCount}</div>
              <div className="text-yellow-200 text-sm mt-1">Warnings</div>
            </div>
            
            <div className="bg-green-900/20 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{sessionCount}</div>
              <div className="text-green-200 text-sm mt-1">Active Sessions</div>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium text-lg mb-4">X-ray Activity (7 Days)</h3>
            
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
      </div>

      {/* AI Analysis Section - Toggleable */}
      {showAiAnalysis && (
        <div className="mb-6 bg-purple-900/20 rounded-xl p-5 border border-purple-800/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-purple-400" />
              AI System Analysis
            </h2>
            
            <button
              onClick={() => setShowAiAnalysis(false)}
              className="p-1 hover:bg-slate-700/50 rounded-full"
              aria-label="Close AI Analysis"
            >
              <X className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-purple-300 mb-3">System Health Evaluation</h3>
              
              <div className="space-y-3">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center mb-2">
                    <div className={`w-3 h-3 rounded-full ${
                      errorCount > 0 ? 'bg-red-500' : 
                      warningCount > 0 ? 'bg-yellow-500' : 
                      'bg-green-500'
                    } mr-2`}></div>
                    <span className="font-medium">X-ray System Status</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {errorCount > 0 ? 
                      'System has encountered errors that require immediate attention.' : 
                      warningCount > 0 ? 
                      'System has warnings that should be addressed soon.' : 
                      'System is operating normally with no detected issues.'
                    }
                  </p>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center mb-2">
                    <Camera className="w-4 h-4 text-blue-400 mr-2" />
                    <span className="font-medium">X-ray Activity</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {panoCount > 0 ? 
                      `${panoCount} panoramic X-rays taken today, which is ${
                        panoCount > 15 ? 'above' : panoCount < 10 ? 'below' : 'within'
                      } average daily volume.` : 
                      'No panoramic X-rays have been taken today.'
                    }
                  </p>
                </div>
                
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center mb-2">
                    <Database className="w-4 h-4 text-blue-400 mr-2" />
                    <span className="font-medium">Database Status</span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {xrayConfig?.isValid ?
                      `Database connection to ${xrayConfig.dbConfig.database} is established and operating normally.` :
                      'Unable to verify database connection status.'
                    }
                  </p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-purple-300 mb-3">Recommendations</h3>
              
              <div className="space-y-3">
                {errorCount > 0 && (
                  <div className="bg-red-900/30 border border-red-800/30 rounded-lg p-3">
                    <h4 className="font-medium text-red-300 mb-1">Critical Issues</h4>
                    <ul className="text-sm space-y-1 list-disc pl-5">
                      <li>Investigate error: "Error connecting to DICOM server"</li>
                      <li>Check network connectivity to imaging devices</li>
                      <li>Verify DICOM server configuration settings</li>
                    </ul>
                  </div>
                )}
                
                {warningCount > 0 && (
                  <div className="bg-yellow-900/30 border border-yellow-800/30 rounded-lg p-3">
                    <h4 className="font-medium text-yellow-300 mb-1">Warnings</h4>
                    <ul className="text-sm space-y-1 list-disc pl-5">
                      <li>Address low disk space warning on image storage</li>
                      <li>Clean up temporary files and old logs</li>
                    </ul>
                  </div>
                )}
                
                <div className="bg-blue-900/30 border border-blue-800/30 rounded-lg p-3">
                  <h4 className="font-medium text-blue-300 mb-1">Preventative Maintenance</h4>
                  <ul className="text-sm space-y-1 list-disc pl-5">
                    <li>Backup database and patient records</li>
                    <li>Check for available software updates for Romexis</li>
                    <li>Validate storage paths and permissions</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Viewer */}
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <FileText className="w-5 h-5 mr-2 text-blue-400" />
          System Logs
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-700">
                <th className="pb-2 font-medium text-slate-300">Timestamp</th>
                <th className="pb-2 font-medium text-slate-300">Severity</th>
                <th className="pb-2 font-medium text-slate-300">Message</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, index) => (
                  <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-3 pr-4 font-mono text-sm whitespace-nowrap">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                        log.severity === 'error' ? 'bg-red-900/50 text-red-300' :
                        log.severity === 'warning' ? 'bg-yellow-900/50 text-yellow-300' :
                        'bg-green-900/50 text-green-300'
                      }`}>
                        {log.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-sm">
                      {log.message.includes('{') && log.message.includes('}') ? (
                        <details>
                          <summary className="cursor-pointer">
                            {log.message.substring(0, log.message.indexOf('{'))}
                          </summary>
                          <pre className="mt-2 p-2 bg-slate-900 rounded text-xs overflow-x-auto">
                            {log.message.substring(log.message.indexOf('{'))}
                          </pre>
                        </details>
                      ) : (
                        log.message
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No logs found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DentalXrayDashboard;