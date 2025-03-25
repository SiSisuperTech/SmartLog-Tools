// server/server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkAwsAuth, loginAwsSso } from './api/aws-auth.js';
import { getClinicData, updateClinic, deleteClinic, addClinic } from './api/clinic-data.js';
import { handleLogRequest } from './api/aws-logs.js';
import { sendSlackNotification } from './api/slack-proxy.js';

// Get directory name in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create Express application
const app = express();

// Apply middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Allow these origins 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Enable logging for all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

// Static files from build directory
app.use(express.static(path.join(__dirname, '../build')));

// API routes
// AWS Authentication
app.get('/api/aws-status', async (req, res) => {
  try {
    const status = await checkAwsAuth();
    res.json(status);
  } catch (error) {
    console.error('Error checking AWS status:', error);
    res.status(500).json({ 
      isAuthenticated: false, 
      error: 'Failed to check AWS authentication status: ' + error.message 
    });
  }
});

app.post('/api/aws-login', async (req, res) => {
  try {
    const loginResult = await loginAwsSso();
    res.json(loginResult);
  } catch (error) {
    console.error('Error logging in to AWS:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to log in to AWS: ' + error.message 
    });
  }
});

// Clinic data management
app.get('/api/clinics', async (req, res) => {
  try {
    const clinics = await getClinicData();
    res.json(clinics);
  } catch (error) {
    console.error('Error fetching clinics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch clinics: ' + error.message 
    });
  }
});

app.post('/api/clinics', async (req, res) => {
  try {
    const result = await addClinic(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error adding clinic:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add clinic: ' + error.message 
    });
  }
});

app.put('/api/clinics/:id', async (req, res) => {
  try {
    const result = await updateClinic(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('Error updating clinic:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update clinic: ' + error.message 
    });
  }
});

app.delete('/api/clinics/:id', async (req, res) => {
  try {
    const result = await deleteClinic(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Error deleting clinic:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete clinic: ' + error.message 
    });
  }
});

// AWS CloudWatch logs endpoint - for real data!
app.post('/api/logs', async (req, res) => {
  await handleLogRequest(req, res);
});

// Slack proxy endpoint to avoid CORS issues
app.post('/api/proxy/slack', async (req, res) => {
  await sendSlackNotification(req, res);
});

// Serve the React app for any other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 