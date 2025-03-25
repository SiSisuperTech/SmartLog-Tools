import { useCallback } from 'react';
import { ClinicMonitoringConfig } from '../types/clinic-types';

export const useClinicSaving = () => {
  const saveClinicApi = useCallback(async (clinics: ClinicMonitoringConfig[]): Promise<{success: boolean, error?: string}> => {
    try {
      console.log(`Saving ${clinics.length} clinics to API`);
      // In a real implementation, this would call the API endpoint to save clinics
      // For demo purposes, we'll just pretend it worked
      return { success: true };
    } catch (error) {
      console.error('Failed to save clinics to API:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }, []);

  const saveMonitoredClinicsToLocalStorage = useCallback((clinics: ClinicMonitoringConfig[]) => {
    try {
      localStorage.setItem('monitoredClinicsData', JSON.stringify(clinics));
      console.log('Monitored clinics saved to localStorage for cross-component access');
    } catch (error) {
      console.error('Error saving monitored clinics to localStorage:', error);
    }
  }, []);

  const saveMonitoredClinics = useCallback(async (clinics: ClinicMonitoringConfig[]) => {
    try {
      // Save to API
      const result = await saveClinicApi(clinics);
      if (!result.success) {
        console.error('Failed to save clinics to API:', result.error);
        return;
      }
      
      // Save to localStorage for cross-component access
      saveMonitoredClinicsToLocalStorage(clinics);
      
      console.log('Monitored clinics saved successfully');
    } catch (error) {
      console.error('Error saving monitored clinics:', error);
    }
  }, [saveClinicApi, saveMonitoredClinicsToLocalStorage]);

  return { saveMonitoredClinics };
}; 