// Authentication Types
export interface AwsAuthStatus {
  isAuthenticated: boolean;
  error?: string;
  identity?: string;
}

// Log-related Types
export interface LogEntry {
  timestamp: string;
  message: string;
  logStream: string;
  severity?: 'info' | 'warning' | 'error';
}



export interface LogAnalysis {
  mistralAnalysis: string;
  errorRate: number;
  commonPatterns: Array<{
    pattern: string;
    count: number;
  }>;
  timeDistribution: Array<{
    hour: number;
    count: number;
  }>;
  severity: {
    info: number;
    warning: number;
    error: number;
  };
}

// Location and Query Types
export interface Location {
  id: number;
  title: string;
}

export interface LogQueryParams {
  startTime: number;
  endTime: number;
  locationIds: number[];
  version: string;
  limit?: number;
}

export interface HomePageProps {
  isAuthenticated: boolean | null;
  isCheckingAuth: boolean;
  onAwsLogin: () => Promise<void>;
  
}
// types.ts
export interface AwsAuthStatus {
  isAuthenticated: boolean;
  error?: string;
  identity?: string;
}

export interface LogViewerProps {
  source?: 'aws' | 'manual';
  logs?: LogEntry[];
  onAnalyze?: (logs: LogEntry[]) => Promise<void>;
}

export interface ManualUploadProps {
  onUpload?: (logs: LogEntry[]) => void;
}

export interface LogAnalysisProps {
  source?: 'aws' | 'manual';
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface MistralAnalysisResponse {
  analysis: string;
  patterns: Array<{
    pattern: string;
    count: number;
  }>;
  timeDistribution: Array<{
    hour: number;
    count: number;
  }>;
  confidence: number;
}

// Form and UI Types
export interface DateRange {
  startTime: string;
  endTime: string;
}

export interface ConnectionStatusProps {
  isAuthenticated: boolean;
}

export interface MistralAnalysisProps {
  logs: LogEntry[];
  onAnalysisComplete: (analysis: string) => void;
}