import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name using ES modules approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to clinics data file
const CLINICS_FILE_PATH = path.resolve(__dirname, '../../data/clinics.json');

// Read clinic data from JSON file
const readClinicData = () => {
  try {
    if (!fs.existsSync(CLINICS_FILE_PATH)) {
      // Initialize with empty data if file doesn't exist
      fs.writeFileSync(CLINICS_FILE_PATH, JSON.stringify({ clinics: [] }, null, 2), 'utf8');
      return { clinics: [] };
    }
    
    const data = fs.readFileSync(CLINICS_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading clinic data:', error);
    return { clinics: [] }; // Return empty data on error
  }
};

// Save clinic data to JSON file
const saveClinicData = (data) => {
  try {
    fs.writeFileSync(CLINICS_FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving clinic data:', error);
    return false;
  }
};

// Get all clinics
export const getAllClinics = () => {
  const data = readClinicData();
  return data.clinics;
};

// Get clinic by ID
export const getClinicById = (clinicId) => {
  const data = readClinicData();
  return data.clinics.find(clinic => clinic.id === clinicId);
};

// Add new clinic
export const addClinic = (clinic) => {
  const data = readClinicData();
  
  // Check if clinic with same ID already exists
  const existingIndex = data.clinics.findIndex(c => c.id === clinic.id);
  if (existingIndex !== -1) {
    return { success: false, error: 'Clinic with this ID already exists' };
  }
  
  // Add the new clinic
  data.clinics.push(clinic);
  
  // Save updated data
  if (saveClinicData(data)) {
    return { success: true, clinic };
  } else {
    return { success: false, error: 'Failed to save clinic data' };
  }
};

// Update clinic
export const updateClinic = (clinicId, updatedData) => {
  const data = readClinicData();
  
  // Find the clinic to update
  const clinicIndex = data.clinics.findIndex(c => c.id === clinicId);
  if (clinicIndex === -1) {
    return { success: false, error: 'Clinic not found' };
  }
  
  // Update clinic data while preserving the ID
  data.clinics[clinicIndex] = {
    ...updatedData,
    id: clinicId // Ensure ID stays the same
  };
  
  // Save updated data
  if (saveClinicData(data)) {
    return { success: true, clinic: data.clinics[clinicIndex] };
  } else {
    return { success: false, error: 'Failed to save clinic data' };
  }
};

// Delete clinic
export const deleteClinic = (clinicId) => {
  const data = readClinicData();
  
  // Check if clinic exists
  const clinicIndex = data.clinics.findIndex(c => c.id === clinicId);
  if (clinicIndex === -1) {
    return { success: false, error: 'Clinic not found' };
  }
  
  // Remove clinic
  data.clinics.splice(clinicIndex, 1);
  
  // Save updated data
  if (saveClinicData(data)) {
    return { success: true };
  } else {
    return { success: false, error: 'Failed to save clinic data' };
  }
};

// Delete all clinics (reset)
export const deleteAllClinics = () => {
  const data = { clinics: [] };
  
  // Save empty data
  if (saveClinicData(data)) {
    return { success: true };
  } else {
    return { success: false, error: 'Failed to reset clinic data' };
  }
}; 