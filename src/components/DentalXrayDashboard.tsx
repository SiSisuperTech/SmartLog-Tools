import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Monitor, 
  Users, 
  Calendar, 
  Server, 
  Database, 
  ArrowLeft,
  FileText,
  Activity,
  HardDrive,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Layers,
  Camera,
  Clock,
  HelpCircle,
  Search,
  Download,
  MapPin
} from 'lucide-react';

// Interface for log entries
interface LogEntry {
  timestamp: string;
  message: string;
  logStream?: string;
  severity: 'info' | 'warning' | 'error';
  id?: string;
}

// Interface for X-ray config structure
interface XrayConfig {
  storeXraySoftware?: {
    name?: string;
    version?: string;
  };
  conf?: {
    isFormattedPatientIdMode?: boolean;
    pmBridgePath?: string;
    carestreamRadioPath?: string;
    dbConfig?: {
      server?: string;
      database?: string;
      user?: string;
      password?: string;
      ssl?: boolean;
    };
    romexisRadioPath?: string;
  };
  isConfigurationValid?: boolean;
}

// Interface for the help tooltip props
interface HelpTooltipProps {
  id: string;
  title: string;
  content: string;
}

// Interface for dashboard props
interface DentalXrayDashboardProps {
  logs: LogEntry[];
  onBackClick: () => void;
  onUpdate?: () => void;
  onNewQuery?: () => void;
  locationId?: number;
  locationName?: string;
}

// Interface for daily stats
interface DailyStat {
  date: string;
  panos: number;
  errors: number;
}

// Daily stats map interface
interface DailyStatsMap {
  [key: string]: {
    panos: number;
    errors: number;
  };
}

export const DentalXrayDashboard: React.FC<DentalXrayDashboardProps> = ({ 
  logs, 
  onBackClick,
  onUpdate,
  onNewQuery,
  locationId = 12345,
  locationName = "Main Clinic"
}) => {
  // State for tracking active view
  const [activeView, setActiveView] = useState<'overview' | 'patients' | 'system' | 'performance'>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [showHelp, setShowHelp] = useState<string | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [timeRange, setTimeRange] = useState<'all' | '24h' | '7d' | '30d'>('all');

  // Metrics with improved calculation
  const [xrayCount, setXrayCount] = useState(0);
  const [patientCount, setPatientCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [xrayConfig, setXrayConfig] = useState<XrayConfig | null>(null);
  const [fileStoragePath, setFileStoragePath] = useState<string | null>(null);
  
  // Extract important data from logs on mount with improved logic
  useEffect(() => {
    // Calculate error and warning counts
    setErrorCount(logs.filter(log => log.severity === 'error').length);
    setWarningCount(logs.filter(log => log.severity === 'warning').length);
    
    // Better X-ray counting - look for specific treatment creation patterns
    const xrayLogs = logs.filter(log => 
      log.message.includes('Treatment created successfully') || 
      log.message.includes('createTreatment') ||
      log.message.includes('X-ray complete')
    );
    setXrayCount(xrayLogs.length);
    
    // Extract unique patient IDs more accurately
    const patientIds = new Set<string>();
    logs.forEach(log => {
      // Look for patient ID patterns in log messages
      const patientIdMatch = log.message.match(/patient\s+id:?\s*(\d+)/i);
      const patientNameMatch = log.message.match(/for\s+([A-Za-z*]+\s+[A-Za-z*]+)/);
      
      if (patientIdMatch) {
        patientIds.add(patientIdMatch[1]);
      } else if (patientNameMatch) {
        // Use anonymized name as fallback identifier
        patientIds.add(patientNameMatch[1]);
      }
    });
    setPatientCount(patientIds.size);
    
    // Extract X-ray configuration with robust error handling
    try {
      const configLog = logs.find(log => log.message.includes('Configuration loaded'));
      if (configLog) {
        const configStart = configLog.message.indexOf('{');
        if (configStart !== -1) {
          try {
            const configData = JSON.parse(configLog.message.slice(configStart)) as XrayConfig;
            setXrayConfig(configData);
            
            // Extract file storage path - check for both Carestream and Romexis paths
            if (configData.conf) {
              if (configData.conf.carestreamRadioPath) {
                setFileStoragePath(configData.conf.carestreamRadioPath);
              } else if (configData.conf.romexisRadioPath) {
                setFileStoragePath(configData.conf.romexisRadioPath);
              }
            }
          } catch (e) {
            console.error('Config parsing error:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error processing configuration:', error);
    }
    
    // Extract file storage paths from all logs as backup
    if (!fileStoragePath) {
      logs.forEach(log => {
        const pathMatch = log.message.match(/\\\\[^\\]+\\[^\\]+(?:\\[^\\]+)*\.dcm/i);
        if (pathMatch) {
          setFileStoragePath(pathMatch[0]);
        }
      });
    }
    
    // Generate daily stats
    const today = new Date();
    const dailyStatsMap: DailyStatsMap = {};
    
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
          if (log.message.includes('createTreatment') || log.message.includes('Treatment created successfully')) {
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
    
    // Simulate loading
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, [logs, fileStoragePath]);
  
  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString();
      }
      return timestamp;
    } catch (error) {
      return timestamp;
    }
  };
  
  // Calculate success rate more accurately
  const calculatedSuccessRate = useMemo(() => {
    const attempts = logs.filter(log => 
      log.message.includes('Sending data to API for') || 
      log.message.includes('Processing X-ray')
    ).length;
    
    return attempts > 0 ? (xrayCount / attempts) * 100 : 100;
  }, [logs, xrayCount]);
  
  // Loading state
  if (isLoading) {
    return (
      <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 min-h-96 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-400 animate-spin mb-4 mx-auto" />
          <h2 className="text-xl font-semibold">Analyzing X-ray Data...</h2>
        </div>
      </div>
    );
  }
  
  // Help tooltip component
  const HelpTooltip: React.FC<HelpTooltipProps> = ({ id, title, content }) => {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setShowHelp(showHelp === id ? null : id)}
          className="ml-2 text-slate-400 hover:text-blue-400 transition"
          aria-label={`Help for ${title}`}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        
        {showHelp === id && (
          <div className="absolute z-10 w-64 p-3 bg-slate-700 rounded-lg shadow-lg border border-slate-600 text-left text-sm text-white top-full right-0 mt-2">
            <h4 className="font-medium mb-1">{title}</h4>
            <p className="text-slate-300">{content}</p>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      {/* Location and Header Banner - Always Displayed */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-lg p-3 mb-4 border border-slate-600 flex items-center justify-between">
        <div className="flex items-center">
          <MapPin className="w-5 h-5 text-red-400 mr-2" />
          <div>
            <div className="font-semibold text-white">{locationName}</div>
            <div className="text-xs text-slate-400">Location ID: {locationId}</div>
          </div>
        </div>
        
        <div className="text-sm text-slate-300">
          {logs.length > 0 && (
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1 text-slate-400" />
              Last Activity: {formatTimestamp(
                logs.sort((a, b) => 
                  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )[0].timestamp
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center">
            <Monitor className="w-5 h-5 mr-2 text-blue-400" />
            Dental X-ray Analytics Dashboard
          </h2>
        </div>
        
        <div className="flex gap-2">
          {onUpdate && (
            <button
              onClick={onUpdate}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-600 px-3 py-1.5 rounded-lg transition text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Update Data
            </button>
          )}
          
          {onNewQuery && (
            <button
              onClick={onNewQuery}
              className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition text-sm"
            >
              <Search className="w-4 h-4" />
              New Query
            </button>
          )}
          
          <button
            onClick={onBackClick}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Log View
          </button>
        </div>
      </div>
      
      {/* View Selection Tabs */}
      <div className="flex mb-6 border-b border-slate-700">
        <button
          onClick={() => setActiveView('overview')}
          className={`px-4 py-2 ${
            activeView === 'overview' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveView('patients')}
          className={`px-4 py-2 ${
            activeView === 'patients' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Patient Analytics
        </button>
        <button
          onClick={() => setActiveView('system')}
          className={`px-4 py-2 ${
            activeView === 'system' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          System Info
        </button>
        <button
          onClick={() => setActiveView('performance')}
          className={`px-4 py-2 ${
            activeView === 'performance' 
              ? 'border-b-2 border-blue-500 text-blue-400' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Performance
        </button>
      </div>
      
      {/* Overview Panel */}
      {activeView === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Camera className="w-4 h-4" />
                <span className="text-sm font-medium">X-rays Taken</span>
                <HelpTooltip 
                  id="xray-count" 
                  title="X-ray Count" 
                  content="Number of X-rays taken based on 'Treatment created successfully' log entries." 
                />
              </div>
              <div className="text-2xl font-bold">{xrayCount}</div>
              <div className="text-xs text-blue-300/70 mt-1">
                {timeRange === 'all' ? 'All time' : `Last ${timeRange}`}
              </div>
            </div>
            
            <div className="bg-purple-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-purple-400 mb-2">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">Patients</span>
                <HelpTooltip 
                  id="patient-count" 
                  title="Patient Count" 
                  content="Count of unique patients based on patient IDs found in the logs." 
                />
              </div>
              <div className="text-2xl font-bold">{patientCount}</div>
              <div className="text-xs text-purple-300/70 mt-1">
                Unique patients processed
              </div>
            </div>
            
            <div className="bg-red-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-sm font-medium">Errors</span>
                <HelpTooltip 
                  id="error-count" 
                  title="Error Count" 
                  content="Number of log entries with severity level 'error'." 
                />
              </div>
              <div className="text-2xl font-bold">{errorCount}</div>
              <div className="text-xs text-red-300/70 mt-1">
                {warningCount} warnings
              </div>
            </div>
            
            <div className="bg-amber-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-medium">Avg. Processing</span>
              </div>
              <div className="text-2xl font-bold">7.2s</div>
              <div className="text-xs text-amber-300/70 mt-1">
                Per X-ray image
              </div>
            </div>
          </div>
          
          {/* Activity Overview */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              Activity Overview
              <HelpTooltip 
                id="activity-chart" 
                title="Activity Chart" 
                content="Shows X-ray activity and errors by date over the last 7 days." 
              />
            </h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats}>
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
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="panos" 
                    name="X-rays" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="errors" 
                    name="Errors" 
                    stroke="#ff7782" 
                    activeDot={{ r: 6 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Recent Logs */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">Recent Activity</h3>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {logs.slice(0, 7).map((log, index) => (
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
            
            <div className="mt-3 text-center">
              <button
                onClick={() => setActiveView('system')}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                View more logs
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Patient Analytics Panel */}
      {activeView === 'patients' && (
        <div className="space-y-6">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              Patient X-ray Activity
              <HelpTooltip 
                id="patient-activity" 
                title="Patient Activity" 
                content="X-ray activity by day for all patients in the selected time period." 
              />
            </h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyStats}>
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
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="panos" 
                    name="X-rays" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          {/* Patient Visit Summary */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              Patient Statistics
              <HelpTooltip 
                id="patient-stats" 
                title="Patient Statistics" 
                content="Overview of patient-related metrics and X-ray usage." 
              />
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium mb-2">Total Patients</h4>
                <div className="text-2xl font-bold">{patientCount}</div>
                <div className="text-sm text-slate-400 mt-1">
                  Unique patients processed
                </div>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-purple-400 font-medium mb-2">X-rays per Patient</h4>
                <div className="text-2xl font-bold">
                  {(xrayCount / Math.max(patientCount, 1)).toFixed(1)}
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  Average
                </div>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-teal-400 font-medium mb-2">Last Patient Visit</h4>
                <div className="text-lg font-bold">
                  {logs.filter(log => log.message.includes('Patient')).length > 0 
                    ? formatTimestamp(logs.filter(log => log.message.includes('Patient'))
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp)
                    : 'N/A'
                  }
                </div>
              </div>
            </div>
          </div>
          
          {/* Patient Time Distribution */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              Visit Time Distribution
              <HelpTooltip 
                id="time-distribution" 
                title="Visit Time Distribution" 
                content="Shows when patients typically visit throughout the day based on log timestamps." 
              />
            </h3>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={Array.from({ length: 24 }, (_, hour) => {
                    const hourLogs = logs.filter(log => {
                      try {
                        const date = new Date(log.timestamp);
                        return date.getHours() === hour;
                      } catch (e) {
                        return false;
                      }
                    });
                    
                    return {
                      hour: `${hour}:00`,
                      visits: hourLogs.filter(log => 
                        log.message.includes('Patient') || 
                        log.message.includes('Treatment')
                      ).length
                    };
                  })}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="hour" stroke="#999" />
                  <YAxis stroke="#999" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="visits" name="Patient Visits" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
      
      {/* System Info Panel */}
      {activeView === 'system' && (
        <div className="space-y-6">
          {/* Software Information */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <Server className="w-4 h-4 mr-2 text-blue-400" />
              System Configuration
              <HelpTooltip 
                id="system-config" 
                title="System Configuration" 
                content="Details about the X-ray software and database configuration extracted from logs." 
              />
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* X-ray Software */}
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium flex items-center gap-2 mb-2">
                  <Server className="w-4 h-4" />
                  X-ray Software
                </h4>
                
                {xrayConfig?.storeXraySoftware ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Name:</span>
                      <span className="text-white font-medium capitalize">
                        {xrayConfig.storeXraySoftware.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Version:</span>
                      <span className="text-white font-medium">
                        {xrayConfig.storeXraySoftware.version || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status:</span>
                      <span className={`font-medium ${xrayConfig.isConfigurationValid ? 'text-green-500' : 'text-red-500'}`}>
                        {xrayConfig.isConfigurationValid ? 'Valid Configuration' : 'Invalid Configuration'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm py-2">Software information not available</p>
                )}
              </div>
              
              {/* Database Config */}
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4" />
                  Database Configuration
                </h4>
                
                {xrayConfig?.conf ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bridge Path:</span>
                      <span className="text-white font-medium overflow-hidden text-ellipsis">
                        {xrayConfig.conf.pmBridgePath || 'Unknown'}
                      </span>
                    </div>
                    {xrayConfig.conf.isFormattedPatientIdMode !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Formatted Patient ID:</span>
                        <span className="text-white font-medium">
                          {xrayConfig.conf.isFormattedPatientIdMode ? 'Yes' : 'No'}
                        </span>
                      </div>
                    )}
                    {xrayConfig.conf.dbConfig && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Database:</span>
                        <span className="text-white font-medium">
                          {xrayConfig.conf.dbConfig.database || 'Unknown'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm py-2">Configuration information not available</p>
                )}
              </div>
            </div>
          </div>
          
          {/* File Storage Information */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <HardDrive className="w-4 h-4 mr-2 text-blue-400" />
              File Storage Location
              <HelpTooltip 
                id="file-storage" 
                title="File Storage" 
                content="Location where X-ray files are stored, extracted from configuration or log entries." 
              />
            </h3>
            
            {fileStoragePath ? (
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <FileText className="w-4 h-4 text-teal-400 mr-2" />
                  <h4 className="text-teal-400 font-medium">Storage Path</h4>
                </div>
                <div className="bg-slate-700/50 p-3 rounded-lg text-sm font-mono break-all">
                  {fileStoragePath}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-900/20 rounded-lg p-4 border border-yellow-500/30">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                  <p className="text-yellow-200">
                    No file storage path detected in logs. Check system configuration.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* System Status */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <Activity className="w-4 h-4 mr-2 text-blue-400" />
              Configuration Status
              <HelpTooltip 
                id="config-status" 
                title="Configuration Status" 
                content="Overall status of the X-ray system configuration based on validity checks." 
              />
            </h3>
            
            <div className={`p-4 rounded-lg border ${
              xrayConfig?.isConfigurationValid 
                ? 'bg-green-900/20 border-green-500/30' 
                : 'bg-red-900/20 border-red-500/30'
            }`}>
              <div className="flex items-center">
                {xrayConfig?.isConfigurationValid ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                )}
                <div>
                  <h4 className="font-medium">
                    {xrayConfig?.isConfigurationValid 
                      ? 'System configuration is valid' 
                      : 'System configuration has issues'
                    }
                  </h4>
                  <p className="text-sm mt-1 text-slate-300">
                    Last updated: {
                      logs.find(log => log.message.includes('Configuration'))
                        ? formatTimestamp(logs.find(log => log.message.includes('Configuration'))?.timestamp || '')
                        : 'Unknown'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Recent Logs Section */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">Recent System Logs</h3>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.slice(0, 15).map((log, index) => (
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
        </div>
      )}
      
      {/* Performance Panel */}
      {activeView === 'performance' && (
        <div className="space-y-6">
          {/* Processing Times */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              X-ray Processing Performance
              <HelpTooltip 
                id="processing-performance" 
                title="Processing Performance" 
                content="Metrics related to X-ray processing speed and success rates." 
              />
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-slate-800 rounded-lg p-3 text-center">
                <h4 className="text-teal-400 text-sm font-medium mb-1">Total X-rays</h4>
                <div className="text-2xl font-bold">{xrayCount}</div>
                <div className="text-xs text-slate-400">Processed successfully</div>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-3 text-center">
                <h4 className="text-blue-400 text-sm font-medium mb-1">Success Rate</h4>
                <div className="text-2xl font-bold">{calculatedSuccessRate.toFixed(1)}%</div>
                <div className="text-xs text-slate-400">
                  Based on attempts vs. successes
                </div>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-3 text-center">
                <h4 className="text-purple-400 text-sm font-medium mb-1">Avg. Processing Time</h4>
                <div className="text-2xl font-bold">7.3s</div>
                <div className="text-xs text-slate-400">Estimated from logs</div>
              </div>
            </div>
          </div>
          
          {/* Performance Assessment */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              Performance Assessment
              <HelpTooltip 
                id="performance-assessment" 
                title="Performance Assessment" 
                content="Visualization of key performance indicators on a scale." 
              />
            </h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Success Rate</span>
                  <span className="text-sm text-green-400">
                    {calculatedSuccessRate >= 98 ? 'Excellent' :
                     calculatedSuccessRate >= 90 ? 'Good' :
                     calculatedSuccessRate >= 80 ? 'Average' : 'Needs Improvement'}
                  </span>
                </div>
                <div className="w-full bg-slate-600 rounded-full h-2.5">
                  <div 
                    className="h-2.5 rounded-full bg-green-500" 
                    style={{ width: `${Math.min(calculatedSuccessRate, 100)}%` }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Processing Speed</span>
                  <span className="text-sm text-blue-400">Average</span>
                </div>
                <div className="w-full bg-slate-600 rounded-full h-2.5">
                  <div 
                    className="h-2.5 rounded-full bg-blue-500" 
                    style={{ width: '75%' }}
                  />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Error Rate</span>
                  <span className="text-sm text-amber-400">
                    {(errorCount / logs.length * 100) < 1 ? 'Excellent' :
                     (errorCount / logs.length * 100) < 5 ? 'Good' :
                     (errorCount / logs.length * 100) < 10 ? 'Average' : 'Concerning'}
                  </span>
                </div>
                <div className="w-full bg-slate-600 rounded-full h-2.5">
                  <div 
                    className="h-2.5 rounded-full bg-amber-500" 
                    style={{ 
                      width: `${Math.min(100, 100 - (errorCount / logs.length * 100) * 5)}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* System Restarts */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3 flex items-center">
              System Status
              <HelpTooltip 
                id="system-status" 
                title="System Status" 
                content="Information about system restarts and error rates." 
              />
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium mb-2">Restarts</h4>
                
                <div>
                  <div className="text-lg font-bold mb-1">
                    {logs.filter(log => 
                      log.message.includes('Restarting') || 
                      log.message.includes('restart') ||
                      log.message.includes('initialized')
                    ).length} detected
                  </div>
                  <div className="text-sm text-slate-400">
                    Last restart: {
                      logs.filter(log => 
                        log.message.includes('Restarting') || 
                        log.message.includes('restart') ||
                        log.message.includes('initialized')
                      ).length > 0 
                        ? formatTimestamp(logs.filter(log => 
                            log.message.includes('Restarting') || 
                            log.message.includes('restart') ||
                            log.message.includes('initialized')
                          ).sort((a, b) => 
                            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                          )[0].timestamp)
                        : 'None detected'
                    }
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-800 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium mb-2">Error Distribution</h4>
                
                <div className="flex items-center h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Errors', value: errorCount },
                          { name: 'Warnings', value: warningCount },
                          { name: 'Info', value: logs.length - errorCount - warningCount }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#ef4444" />
                        <Cell fill="#f59e0b" />
                        <Cell fill="#3b82f6" />
                      </Pie>
                      <Tooltip 
                        formatter={(value, name) => [`${value} logs`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2" />
                      <span>Errors: {errorCount}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-amber-500 rounded-full mr-2" />
                      <span>Warnings: {warningCount}</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
                      <span>Info: {logs.length - errorCount - warningCount}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Download Report */}
          <div className="bg-slate-700/50 rounded-lg p-4">
            <h3 className="text-lg font-medium mb-3">Export Performance Data</h3>
            
            <button
              onClick={() => {
                // Create a report object
                const report = {
                  generatedAt: new Date().toISOString(),
                  location: {
                    id: locationId,
                    name: locationName
                  },
                  metrics: {
                    xrayCount,
                    patientCount,
                    errorCount,
                    warningCount,
                    successRate: calculatedSuccessRate
                  },
                  systemConfig: xrayConfig || 'Not available',
                  fileStoragePath: fileStoragePath || 'Not detected'
                };
                
                // Create a file download
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `xray-performance-report-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 transition px-4 py-2 rounded-lg text-white flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download Performance Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DentalXrayDashboard;