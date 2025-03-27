import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Search, 
  Clock, 
  Tag, 
  MapPin, 
  ChevronDown, 
  Check,
  UserCircle,
  X,
  Filter,
  Plus
} from 'lucide-react';
import { useAwsAuth } from '../hooks/useAwsAuth';
import locationData from '../data.json';

type Location = {
  ID: number;
  Title: string;
};

interface QueryParams {
  startDate: string;
  endDate: string;
  version: string;
  locationIds: number[];
  awsProfile: string;
}

// Define interfaces for CloudWatch log entries
interface CloudWatchLogField {
  field: string;
  value: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  logStream: string;
  severity: 'info' | 'warning' | 'error';
}

// Function to transform CloudWatch log format to our application format
const transformCloudWatchLogs = (cloudWatchResults: any[]): any[] => {
  if (!cloudWatchResults || !Array.isArray(cloudWatchResults)) {
    console.error('Invalid CloudWatch results format:', cloudWatchResults);
    return [];
  }
  
  return cloudWatchResults.map(logEntry => {
    // Each CloudWatch log entry is an array of field-value pairs
    if (!Array.isArray(logEntry)) {
      console.error('Unexpected log entry format:', logEntry);
      return {
        timestamp: new Date().toISOString(),
        message: 'Error: Invalid log format',
        logStream: 'unknown',
        severity: 'error'
      };
    }

    // Extract fields from the CloudWatch format
    let timestamp = '';
    let message = '';
    let logStream = 'unknown';
    
    // Process each field in the log entry
    logEntry.forEach(field => {
      if (field.field === '@timestamp') {
        // Convert CloudWatch timestamp format to ISO
        const cwTimestamp = field.value;
        // Try to parse the timestamp format "YYYY-MM-DD HH:MM:SS.mmm"
        try {
          if (cwTimestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
            // Replace space with T and add Z for timezone
            timestamp = cwTimestamp.replace(' ', 'T') + 'Z';
          } else {
            timestamp = new Date(cwTimestamp).toISOString();
          }
        } catch (e) {
          console.warn('Failed to parse timestamp:', cwTimestamp);
          timestamp = new Date().toISOString();
        }
      } 
      else if (field.field === '@message') {
        message = field.value;
      }
      else if (field.field === '@logStream') {
        logStream = field.value;
      }
    });
    
    // Determine severity based on message content
    let severity = 'info';
    if (message) {
      const lowercaseMsg = message.toLowerCase();
      if (lowercaseMsg.includes('error') || 
          lowercaseMsg.includes('exception') || 
          lowercaseMsg.includes('fail')) {
        severity = 'error';
      } 
      else if (lowercaseMsg.includes('warn') || 
          lowercaseMsg.includes('warning')) {
        severity = 'warning';
      }
    }
    
    // Determine if it's actually an info, warning, or error based on the first word
    if (message.startsWith('info')) {
      severity = 'info';
    } else if (message.startsWith('warning') || message.startsWith('warn')) {
      severity = 'warning';
    } else if (message.startsWith('error')) {
      severity = 'error';
    }
    
    return {
      timestamp,
      message,
      logStream,
      severity
    };
  });
};

const LogQueryPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAwsAuth();
  const [queryParams, setQueryParams] = useState<QueryParams>({
    startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    endDate: new Date().toISOString().slice(0, 16),
    version: '2.4.5',
    locationIds: [],
    awsProfile: 'Auto-detect' 
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([]);
  
  // New state for manual location entry
  const [manualLocationId, setManualLocationId] = useState<string>('');
  const [manualLocationName, setManualLocationName] = useState<string>('');
  const [showManualEntry, setShowManualEntry] = useState<boolean>(false);

  // Filter locations based on search term
  const filteredLocations = locationData.filter(location => 
    location.Title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Update selected locations whenever locationIds changes
  useEffect(() => {
    const selected = locationData.filter(loc => queryParams.locationIds.includes(loc.ID));
    setSelectedLocations(selected);
  }, [queryParams.locationIds]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      alert('Authentication required');
      return;
    }
    
    if (queryParams.locationIds.length === 0) {
      alert('Please select at least one location');
      return;
    }
    
    setIsLoading(true);
    try {
      const queryBody = {
        startTime: Math.floor(new Date(queryParams.startDate).getTime() / 1000),
        endTime: Math.floor(new Date(queryParams.endDate).getTime() / 1000),
        locationIds: queryParams.locationIds,
        version: queryParams.version,
        awsProfile: queryParams.awsProfile,
        limit: 10000
      };
      
      console.log('Sending request with body:', JSON.stringify(queryBody, null, 2));
      
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody)
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Raw API response:', typeof data, Array.isArray(data) ? data.length : Object.keys(data));
      
      try {
        // The API now returns an array of log objects directly
        if (Array.isArray(data)) {
          console.log(`Processing ${data.length} logs received directly from API`);
          
          // Store the logs
          if (data.length > 1000) {
            console.log(`Storing ${data.length} logs in chunks`);
            
            // Clear previous storage
            const keys = Object.keys(sessionStorage).filter(key => 
              key.startsWith('awsLogs_chunk_'));
            keys.forEach(key => sessionStorage.removeItem(key));
            
            // Set metadata
            sessionStorage.setItem('logSource', 'aws');
            sessionStorage.setItem('logCount', String(data.length));
            
            // Store logs in chunks
            const MAX_CHUNK_SIZE = 1000;
            const chunks = Math.ceil(data.length / MAX_CHUNK_SIZE);
            for (let i = 0; i < chunks; i++) {
              const start = i * MAX_CHUNK_SIZE;
              const end = Math.min(start + MAX_CHUNK_SIZE, data.length);
              const chunk = data.slice(start, end);
              sessionStorage.setItem(`awsLogs_chunk_${i}`, JSON.stringify(chunk));
            }
            
            sessionStorage.setItem('awsLogs_chunks', String(chunks));
          } else {
            // Store as a single unit for smaller datasets
            sessionStorage.setItem('awsLogs', JSON.stringify(data));
            sessionStorage.setItem('logSource', 'aws');
          }
        }
        // Legacy format handling (results field)
        else if (data.results) {
          const logData = data.results;
          console.log(`Processing ${logData.length} logs from results field`);
          
          if (logData.length > 1000) {
            console.log(`Storing ${logData.length} logs in chunks`);
            
            // Clear previous storage
            const keys = Object.keys(sessionStorage).filter(key => 
              key.startsWith('awsLogs_chunk_'));
            keys.forEach(key => sessionStorage.removeItem(key));
            
            // Set metadata
            sessionStorage.setItem('logSource', 'aws');
            sessionStorage.setItem('logCount', String(logData.length));
            
            // Store logs in chunks
            const MAX_CHUNK_SIZE = 1000;
            const chunks = Math.ceil(logData.length / MAX_CHUNK_SIZE);
            for (let i = 0; i < chunks; i++) {
              const start = i * MAX_CHUNK_SIZE;
              const end = Math.min(start + MAX_CHUNK_SIZE, logData.length);
              const chunk = logData.slice(start, end);
              sessionStorage.setItem(`awsLogs_chunk_${i}`, JSON.stringify(chunk));
            }
            
            sessionStorage.setItem('awsLogs_chunks', String(chunks));
          } else {
            sessionStorage.setItem('awsLogs', JSON.stringify({ results: logData }));
            sessionStorage.setItem('logSource', 'aws');
          }
        }
        else {
          throw new Error('Unknown log data format received from server');
        }
        
        // Save query params for future reference
        sessionStorage.setItem('lastLocationIds', JSON.stringify(queryParams.locationIds));
        sessionStorage.setItem('lastVersion', queryParams.version);
        
        // Navigate to log analysis page
        navigate('/log-analysis');
      } catch (storageError) {
        console.error('Error storing logs:', storageError);
        alert('Failed to store logs. The dataset may be too large.');
      }
    } catch (error) {
      console.error('Log query failed:', error);
      
      let errorMessage = 'Failed to query logs';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  const toggleLocation = (id: number) => {
    setQueryParams(prev => ({
      ...prev,
      locationIds: prev.locationIds.includes(id)
        ? prev.locationIds.filter(locId => locId !== id)
        : [...prev.locationIds, id]
    }));
  };

  const removeLocation = (id: number) => {
    setQueryParams(prev => ({
      ...prev,
      locationIds: prev.locationIds.filter(locId => locId !== id)
    }));
  };

  const selectAllFilteredLocations = () => {
    const filteredIds = filteredLocations.map(loc => loc.ID);
    setQueryParams(prev => ({
      ...prev,
      locationIds: [...new Set([...prev.locationIds, ...filteredIds])]
    }));
  };

  const clearAllLocations = () => {
    setQueryParams(prev => ({
      ...prev,
      locationIds: []
    }));
  };

  // Add new function to handle manual location addition
  const handleAddManualLocation = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Validate inputs
    const locationId = parseInt(manualLocationId, 10);
    if (isNaN(locationId) || locationId <= 0) {
      alert('Please enter a valid location ID (positive number)');
      return;
    }
    
    if (!manualLocationName.trim()) {
      alert('Please enter a location name');
      return;
    }
    
    // Check if the location ID already exists
    if (queryParams.locationIds.includes(locationId)) {
      alert('This location ID is already selected');
      return;
    }
    
    // Create a new location object
    const newLocation: Location = {
      ID: locationId,
      Title: manualLocationName.trim()
    };
    
    // Add to selected locations and update locationIds
    setSelectedLocations(prev => [...prev, newLocation]);
    setQueryParams(prev => ({
      ...prev,
      locationIds: [...prev.locationIds, locationId]
    }));
    
    // Reset form fields
    setManualLocationId('');
    setManualLocationName('');
    setShowManualEntry(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 p-6 flex items-center justify-center">
        <div className="max-w-md w-full p-8 bg-slate-800 rounded-2xl shadow-lg text-center">
          <h2 className="text-2xl text-white mb-6 flex items-center justify-center gap-3">
            🔒 <span>Checking AWS</span>
          </h2>
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 004 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
          <span>Please Wait </span>
        </div>
        
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 p-6">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-8 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" /> 
          <span className="text-lg font-medium">Back to Dashboard</span>
        </button>

        <div className="bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-700">
          <h1 className="text-3xl text-white flex items-center gap-4 mb-8 font-normal">
            <Search className="w-8 h-8 text-blue-400" />
            CloudWatch Log Query
          </h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Time Range Section */}
            <div className="bg-slate-700/70 rounded-xl p-6 border border-slate-600">
              <h2 className="text-xl text-white mb-4 font-medium flex items-center gap-2">
                <Clock className="text-blue-400" />
                Time Range
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(['startDate', 'endDate'] as const).map(dateType => (
                  <div key={dateType}>
                    <label className="block text-white/80 mb-2">
                      {dateType === 'startDate' ? 'Start Time' : 'End Time'}
                    </label>
                    <input
                      type="datetime-local"
                      value={queryParams[dateType]}
                      onChange={e => setQueryParams({ ...queryParams, [dateType]: e.target.value })}
                      className="w-full bg-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition border border-slate-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Version and Profile Section */}
            <div className="bg-slate-700/70 rounded-xl p-6 border border-slate-600">
              <h2 className="text-xl text-white mb-4 font-medium flex items-center gap-2">
                <Tag className="text-green-400" />
                Configuration
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white/80 mb-2">
                    Log Version
                  </label>
                  <div className="relative">
                    <select
                      value={queryParams.version}
                      onChange={e => setQueryParams({ ...queryParams, version: e.target.value })}
                      className="w-full appearance-none bg-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition border border-slate-500"
                    >
                      <option value="2.4.5">2.4.5</option>
                      <option value="2.4.4">2.4.4</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-white/80 mb-2">
                    AWS Profile
                  </label>
                  <div className="relative">
                    <select
                      value={queryParams.awsProfile}
                      onChange={e => setQueryParams({ ...queryParams, awsProfile: e.target.value })}
                      className="w-full appearance-none bg-slate-600 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition border border-slate-500"
                    >
                      <option value="Auto-detect">Auto-detect</option>
                      <option value="default">default</option>
                      <option value="prod">prod</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Locations Section */}
            <div className="bg-slate-700/70 rounded-xl p-6 border border-slate-600">
              <h2 className="text-xl text-white mb-4 font-medium flex items-center gap-2">
                <MapPin className="text-red-400" />
                Locations
              </h2>
              
              {/* Location Selector */}
              <div ref={locationDropdownRef} className="relative mb-4">
                <div
                  className="flex items-center justify-between px-4 py-3 bg-slate-600 rounded-lg cursor-pointer transition hover:bg-slate-500 border border-slate-500"
                  onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-5 w-5 text-white/70" />
                    <span className="text-white">
                      {queryParams.locationIds.length 
                        ? `${queryParams.locationIds.length} location${queryParams.locationIds.length > 1 ? 's' : ''} selected`
                        : 'Select locations'
                      }
                    </span>
                  </div>
                  <ChevronDown 
                    className={`w-5 h-5 text-white/70 transition-transform ${isLocationDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </div>

                {isLocationDropdownOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-slate-700 rounded-lg shadow-xl border border-slate-600 overflow-hidden">
                    <div className="p-4 border-b border-slate-600">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 h-4 w-4" />
                        <input
                          type="text"
                          placeholder="Search locations..."
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          className="w-full bg-slate-600 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 text-white border border-slate-500"
                        />
                      </div>
                    </div>
                    
                    <div className="p-2 border-b border-slate-600 flex justify-between">
                      <button
                        type="button"
                        onClick={selectAllFilteredLocations}
                        className="text-sm text-blue-400 hover:text-blue-300 transition px-2 py-1"
                      >
                        Select all filtered
                      </button>
                      <button
                        type="button"
                        onClick={clearAllLocations}
                        className="text-sm text-red-400 hover:text-red-300 transition px-2 py-1"
                      >
                        Clear all
                      </button>
                    </div>
                    
                    {/* Manual Location Entry */}
                    <div className="p-3 border-b border-slate-600">
                      <button
                        type="button"
                        onClick={() => setShowManualEntry(!showManualEntry)}
                        className="flex items-center gap-2 text-green-400 hover:text-green-300 transition w-full justify-center py-1"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Custom Location</span>
                      </button>
                      
                      {showManualEntry && (
                        <form onSubmit={handleAddManualLocation} className="mt-3 space-y-3">
                          <div>
                            <label className="block text-white/80 text-sm mb-1">
                              Location ID (number)
                            </label>
                            <input
                              type="number"
                              value={manualLocationId}
                              onChange={e => setManualLocationId(e.target.value)}
                              placeholder="Enter location ID"
                              className="w-full bg-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition border border-slate-500 text-sm"
                              min="1"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-white/80 text-sm mb-1">
                              Location Name
                            </label>
                            <input
                              type="text"
                              value={manualLocationName}
                              onChange={e => setManualLocationName(e.target.value)}
                              placeholder="Enter location name"
                              className="w-full bg-slate-600 text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition border border-slate-500 text-sm"
                              required
                            />
                          </div>
                          <div className="flex justify-end">
                            <button
                              type="submit"
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add Location
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto">
                      {filteredLocations.length > 0 ? (
                        filteredLocations.map(location => (
                          <div
                            key={location.ID}
                            className={`px-4 py-3 cursor-pointer transition-colors ${
                              queryParams.locationIds.includes(location.ID) 
                                ? 'bg-blue-600/40' 
                                : 'bg-slate-700 hover:bg-slate-600'
                            }`}
                            onClick={() => toggleLocation(location.ID)}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-white">{location.Title}</span>
                              {queryParams.locationIds.includes(location.ID) && (
                                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-white/50 text-center bg-slate-700">
                          No locations found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Selected Locations Display */}
              {selectedLocations.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedLocations.map(location => (
                      <div 
                        key={location.ID}
                        className="bg-blue-600/30 text-white px-3 py-1 rounded-full flex items-center gap-2 border border-blue-600/50"
                      >
                        <span className="text-sm">{location.Title}</span>
                        <button 
                          type="button"
                          onClick={() => removeLocation(location.ID)}
                          className="text-white/70 hover:text-white transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || queryParams.locationIds.length === 0}
              className="w-full bg-blue-600 text-white py-4 rounded-lg transition-colors hover:bg-blue-700 disabled:bg-blue-400/50 disabled:cursor-not-allowed relative shadow-lg"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 004 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Querying Logs...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <Search className="h-5 w-5" />
                  <span>Run Log Analysis</span>
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LogQueryPage;