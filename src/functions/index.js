// functions/index.js
const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const { checkAwsAuth, loginAwsSso } = require('./aws-auth');

// Convert your Express server to Firebase Function
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// AWS authentication endpoints
app.get('/aws-status', async (req, res) => {
  try {
    const status = await checkAwsAuth();
    res.json(status);
  } catch (error) {
    console.error('Error checking AWS status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/aws-login', async (req, res) => {
  try {
    const result = await loginAwsSso();
    res.json(result);
  } catch (error) {
    console.error('Error logging in to AWS:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logs endpoint
app.post('/logs', async (req, res) => {
  try {
    // Import dynamically to avoid issues with ESM vs CJS
    const { logsHandler } = require('./logshandler');
    return logsHandler(req, res);
  } catch (error) {
    console.error('Error in logs endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Export the Express API as a Firebase Function
exports.api = functions.https.onRequest(app);

// User authentication functions (from previous examples)
exports.setUserClaims = functions.https.onCall(async (data, context) => {
  // Check if the caller is authorized to set claims
  if (!context.auth || !context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can set user claims'
    );
  }

  const { uid, claims } = data;
  
  try {
    // Set custom claims for the user
    await admin.auth().setCustomUserClaims(uid, claims);
    return { success: true };
  } catch (error) {
    console.error('Error setting custom claims:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// Add more Firebase functions as needed for authentication management