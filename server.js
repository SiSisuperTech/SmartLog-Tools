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
  deleteAllClinics,
  getAvailableClinics
} from './server/api/clinic-data.js';
import net from 'net';
import fs from 'fs';
import path from 'path';

// Function to check if a port is in use
const isPortInUse = (port) => {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
};

// Function to find an available port
const findAvailablePort = async (startPort, maxAttempts = 10) => {
  let port = startPort;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return port;
    }
    port++;
    attempts++;
  }
  
  throw new Error(`Could not find an available port after ${maxAttempts} attempts`);
};

// Store server process info
const saveServerInfo = (port) => {
  const serverInfo = {
    pid: process.pid,
    port: port,
    startTime: new Date().toISOString()
  };
  
  try {
    fs.writeFileSync(
      path.join(process.cwd(), '.server-info.json'),
      JSON.stringify(serverInfo, null, 2)
    );
    console.log(`Server info saved: PID ${process.pid}, port ${port}`);
  } catch (error) {
    console.error('Failed to save server info:', error);
  }
};

// Try to kill any existing server process
const killExistingServer = () => {
  try {
    if (fs.existsSync(path.join(process.cwd(), '.server-info.json'))) {
      const serverInfo = JSON.parse(
        fs.readFileSync(path.join(process.cwd(), '.server-info.json'), 'utf8')
      );
      
      if (serverInfo.pid) {
        try {
          // On Windows, we can't directly kill using Node.js
          if (process.platform === 'win32') {
            require('child_process').execSync(`taskkill /pid ${serverInfo.pid} /f`);
          } else {
            process.kill(serverInfo.pid, 'SIGTERM');
          }
          console.log(`Killed existing server process (PID: ${serverInfo.pid})`);
        } catch (killError) {
          console.log(`No process found with PID: ${serverInfo.pid} or it's already terminated`);
        }
      }
    }
  } catch (error) {
    console.error('Error handling existing server:', error);
  }
};

// Explicitly import node-fetch using a dynamic import with await
let fetch;
(async () => {
  const module = await import('node-fetch');
  fetch = module.default;
  console.log('node-fetch loaded successfully');
})();

// Try to kill any existing server before starting
killExistingServer();

const app = express();
const DEFAULT_PORT = 3005;

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

// Add the missing check-aws-auth endpoint
app.get('/api/check-aws-auth', async (req, res) => {
  try {
    const status = await checkAwsAuth();
    res.json({ 
      authenticated: status.isAuthenticated,
      identity: status.identity,
      error: status.error
    });
  } catch (error) {
    console.error('Error checking AWS authentication:', error);
    res.status(500).json({ 
      authenticated: false, 
      error: 'Internal server error' 
    });
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

// GET - Get available clinics for monitoring
app.get('/api/clinics/available', (req, res) => {
  try {
    const availableClinics = getAvailableClinics();
    res.json(availableClinics);
  } catch (error) {
    console.error('Error fetching available clinics:', error);
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

// Start the server with intelligent port handling
const startServer = async () => {
  try {
    const port = await findAvailablePort(DEFAULT_PORT);
    
    const server = app.listen(port, () => {
      console.log(`Server running on port ${port}${port !== DEFAULT_PORT ? ' (default port was in use)' : ''}`);
      
      // Save server info for future reference
      saveServerInfo(port);
    });
    
    // Handle graceful shutdown
    const gracefulShutdown = () => {
      console.log('Shutting down server gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
      
      // Force close after 10 seconds if it doesn't close gracefully
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };
    
    // Listen for termination signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();