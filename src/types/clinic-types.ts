export interface ClinicMonitoringConfig {
  id: string;
  name: string;
  locationId: string;
  schedule: 'hourly' | 'daily' | 'weekly';
  lastRun: string | null;
  nextRun: string | null;
  slackEnabled: boolean;
  slackWebhook?: string;
  slackChannel?: string;
  isActive: boolean;
  lastPanoTime: string | null;
  noActivityAlertSent: boolean;
  status?: 'inactive' | 'active' | 'warning';
}

export interface TreatmentInfo {
  timestamp: string;
  patientId: string;
  patientName: string;
  type: string;
  success: boolean;
}

export interface MonitoringSummary {
  id: string;
  clinicId: string;
  timestamp: string;
  xraysTotal: number;
  status: 'inactive' | 'active' | 'warning';
  lastPanoTime: string | null;
  treatments: TreatmentInfo[];
} 