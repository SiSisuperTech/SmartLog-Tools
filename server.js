import express from 'express';
import cors from 'cors';
import { checkAwsAuth, loginAwsSso } from './server/api/aws-auth.js';
import { logsHandler } from './src/api/logshandler.js';
import { 
  getAllClinics, 
  getClinicById, 
  addClinic, 
  updateClinic, 
  deleteClinic, 
  deleteAllClinics 
} from './server/api/clinic-data.js';

// Explicitly import node-fetch using a dynamic import with await
let fetch;
(async () => {
  const module = await import('node-fetch');
  fetch = module.default;
  console.log('node-fetch loaded successfully');
})();

const app = express();
const PORT = 3005; // Fixed port

app.use(cors());
app.use(express.json());

// Restore original routes with /api prefix for AWS functions
app.get('/api/aws-status', async (req, res) => {
  try {
    const status = await checkAwsAuth();
    res.json(status);
  } catch (error) {
    console.error('Error checking AWS status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/aws-login', async (req, res) => {
  try {
    const result = await loginAwsSso();
    res.json(result);
  } catch (error) {
    console.error('Error logging in to AWS:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add both versions of the logs endpoint to ensure it works
app.post('/api/logs', logsHandler); // With /api prefix
app.post('/logs', logsHandler);     // Without /api prefix

// Slack proxy endpoint
app.post('/api/proxy/slack', async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body;
    
    if (!webhookUrl || !payload) {
      return res.status(400).json({ 
        error: 'Missing required parameters: webhookUrl and payload are required' 
      });
    }
    
    console.log(`Sending Slack notification to ${webhookUrl}`);
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const responseText = await response.text();
    console.log(`Slack API response [${response.status}]: ${responseText}`);
    
    if (!response.ok) {
      throw new Error(`Slack API responded with ${response.status}: ${responseText}`);
    }
    
    console.log('Slack notification sent successfully');
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Clinic API Endpoints
// GET - Get all clinics
app.get('/api/clinics', (req, res) => {
  try {
    const clinics = getAllClinics();
    res.json({ success: true, clinics });
  } catch (error) {
    console.error('Error fetching clinics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET - Get clinic by ID
app.get('/api/clinics/:id', (req, res) => {
  try {
    const { id } = req.params;
    const clinic = getClinicById(id);
    
    if (!clinic) {
      return res.status(404).json({ success: false, error: 'Clinic not found' });
    }
    
    res.json({ success: true, clinic });
  } catch (error) {
    console.error('Error fetching clinic:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Add new clinic
app.post('/api/clinics', (req, res) => {
  try {
    const result = addClinic(req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding clinic:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT - Update clinic
app.put('/api/clinics/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = updateClinic(id, req.body);
    
    if (!result.success) {
      const statusCode = result.error === 'Clinic not found' ? 404 : 400;
      return res.status(statusCode).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error updating clinic:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE - Delete clinic
app.delete('/api/clinics/:id', (req, res) => {
  try {
    const { id } = req.params;
    const result = deleteClinic(id);
    
    if (!result.success) {
      const statusCode = result.error === 'Clinic not found' ? 404 : 400;
      return res.status(statusCode).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error deleting clinic:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE - Delete all clinics (reset)
app.delete('/api/clinics', (req, res) => {
  try {
    const result = deleteAllClinics();
    
    if (!result.success) {
      return res.status(500).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error resetting clinics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});