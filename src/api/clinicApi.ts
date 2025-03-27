import { ClinicMonitoringConfig } from '../types/clinic-types';

// API base URL determination based on environment
const getApiBaseUrl = () => {
  // In production or when not explicitly in development, use relative URLs
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  // In development, try to use the localhost URL
  return 'http://localhost:3005/api';
};

const API_BASE_URL = getApiBaseUrl();

// Fetch all clinics
export const fetchClinics = async (): Promise<ClinicMonitoringConfig[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch clinics');
    }
    
    const data = await response.json();
    return data.clinics;
  } catch (error) {
    console.error('Error fetching clinics:', error);
    // Return empty array on error to avoid breaking the UI
    return [];
  }
};

// Fetch a single clinic by ID
export const fetchClinicById = async (id: string): Promise<ClinicMonitoringConfig | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics/${id}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch clinic');
    }
    
    const data = await response.json();
    return data.clinic;
  } catch (error) {
    console.error(`Error fetching clinic ${id}:`, error);
    return null;
  }
};

// Add a new clinic
export const addClinic = async (clinic: ClinicMonitoringConfig): Promise<{success: boolean, clinic?: ClinicMonitoringConfig, error?: string}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clinic),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to add clinic');
    }
    
    return data;
  } catch (error) {
    console.error('Error adding clinic:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Update a clinic
export const updateClinic = async (id: string, clinic: ClinicMonitoringConfig): Promise<{success: boolean, clinic?: ClinicMonitoringConfig, error?: string}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clinic),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to update clinic');
    }
    
    return data;
  } catch (error) {
    console.error(`Error updating clinic ${id}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Delete a clinic
export const deleteClinic = async (id: string): Promise<{success: boolean, error?: string}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics/${id}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete clinic');
    }
    
    return data;
  } catch (error) {
    console.error(`Error deleting clinic ${id}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};

// Delete all clinics (reset)
export const resetAllClinics = async (): Promise<{success: boolean, error?: string}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/clinics`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to reset clinics');
    }
    
    return data;
  } catch (error) {
    console.error('Error resetting clinics:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}; 