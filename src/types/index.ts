export interface LogEntry {
    timestamp: string;
    message: string;
    logStream: string;
    severity?: 'info' | 'warning' | 'error';
  }
  
  export interface LogAnalysis {
    mistralAnalysis: string;
    patterns: Array<{pattern: string, count: number}>;
    timeDistribution: Array<{hour: number, count: number}>;
  }
  
  export interface AwsAuthStatus {
    isAuthenticated: boolean;
    error?: string;
  }
  
  export interface LogQueryParams {
    startTime: number;
    endTime: number;
    locationIds: number[];
    version: string;
  }