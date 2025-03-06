import express from 'express';
import cors from 'cors';
import { checkAwsAuth, loginAwsSso } from './server/api/aws-auth.js';
import { logsHandler } from './src/api/logshandler.js';

const app = express();
const PORT = process.env.PORT || 3002;

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

console.log('Is Windows?', process.platform === 'win32');
// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${server.address().port}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('Address in use, retrying...');
    setTimeout(() => {
      server.close();
      server.listen(0); // Choose random available port
    }, 1000);
  }
});