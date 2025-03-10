// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');

// Initialize Firebase Admin
admin.initializeApp();

// Import the analyze-logs function and SSO helper
const { analyzeLogs } = require('./analyze-logs');
const { validateAuth } = require('./auth-middleware');
const { getAwsSsoCredentials, storeAwsSsoCredentials } = require('./aws-sso-helper');

// Create Express app for API endpoints
const app = express();

// CORS configuration - MUST come before routes
app.use(cors({
  origin: [
    'https://smart-log-bbc65.web.app',
    'https://smart-log-bbc65.firebaseapp.com',
    'http://localhost:3000',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// AWS status check endpoint
app.get('/aws-status', validateAuth, async (req, res) => {
  try {
    console.log('Checking AWS authentication for user:', req.user.email);
    
    // Get AWS SSO credentials from Firestore
    const awsConfigured = await getAwsSsoCredentials();
    if (!awsConfigured) {
      return res.json({ 
        isAuthenticated: false,
        error: 'AWS SSO credentials not found or expired',
        identity: null 
      });
    }
    
    // Create STS service object
    const sts = new AWS.STS();
    
    try {
      // Get caller identity
      const identity = await sts.getCallerIdentity().promise();
      console.log('AWS identity:', identity);
      
      return res.json({ 
        isAuthenticated: true,
        error: null,
        identity: identity.Arn 
      });
    } catch (awsError) {
      console.error('AWS authentication check failed:', awsError);
      return res.json({ 
        isAuthenticated: false,
        error: 'Failed to authenticate with AWS: ' + awsError.message,
        identity: null 
      });
    }
  } catch (error) {
    console.error('Error in AWS status check:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// AWS login endpoint for compatibility with frontend
app.post('/aws-login', validateAuth, async (req, res) => {
  try {
    console.log('AWS login requested by:', req.user.email);
    
    // Since we can't do browser-based SSO in Functions,
    // we'll check if we have valid stored credentials
    const awsConfigured = await getAwsSsoCredentials();
    
    if (!awsConfigured) {
      return res.status(400).json({
        success: false,
        error: 'AWS SSO credentials not found or expired. Please run the credential uploader tool.',
        needsCredentials: true
      });
    }
    
    // Create STS service object to verify credentials
    const sts = new AWS.STS();
    
    try {
      // Verify credentials by calling getCallerIdentity
      const identity = await sts.getCallerIdentity().promise();
      console.log('AWS identity verified:', identity.Arn);
      
      return res.json({
        success: true,
        message: 'AWS SSO authentication successful',
        identity: identity.Arn
      });
    } catch (awsError) {
      console.error('AWS authentication failed:', awsError);
      return res.status(400).json({
        success: false,
        error: 'AWS authentication failed: ' + awsError.message,
        needsCredentials: true
      });
    }
  } catch (error) {
    console.error('Error in AWS login:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// CloudWatch logs query endpoint
app.post('/logs', validateAuth, async (req, res) => {
  try {
    // First, ensure AWS SSO credentials are valid
    const awsConfigured = await getAwsSsoCredentials();
    if (!awsConfigured) {
      return res.status(400).json({
        success: false,
        error: 'AWS SSO credentials not found or expired',
        needsCredentials: true
      });
    }
    
    // Implement CloudWatch Logs query using AWS SDK
    const { startTime, endTime, locationIds, version } = req.body;
    
    // Create CloudWatch Logs client
    const logs = new AWS.CloudWatchLogs();
    
    // Create query string (sanitize inputs)
    const queryString = `
      fields @timestamp, @message, @logStream
      | filter userId in [${locationIds.map(id => `'${id.toString().replace(/'/g, '')}'`).join(', ')}]
      | filter version = "${version.replace(/"/g, '\\"')}"
      | sort @timestamp desc
      | limit 1000
    `;
    
    // Start the query
    const startQueryResponse = await logs.startQuery({
      logGroupName: '/aws/lambda/your-log-group', // Update to your log group
      startTime: Math.floor(startTime / 1000),
      endTime: Math.floor(endTime / 1000),
      queryString
    }).promise();
    
    const queryId = startQueryResponse.queryId;
    
    // Poll for results (simplified - might time out for large queries)
    let results;
    let complete = false;
    let retries = 0;
    
    while (!complete && retries < 10) {
      const queryResults = await logs.getQueryResults({ queryId }).promise();
      
      if (queryResults.status === 'Complete') {
        complete = true;
        results = queryResults.results;
      } else {
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
      }
    }
    
    if (!complete) {
      return res.status(408).json({ error: 'Query timed out' });
    }
    
    // Process and return results
    const processedLogs = results.map(result => {
      const entry = {};
      result.forEach(field => {
        // Remove @ from field names
        const key = field.field.startsWith('@') ? field.field.substring(1) : field.field;
        entry[key] = field.value;
      });
      
      return {
        timestamp: entry.timestamp || new Date().toISOString(),
        message: entry.message || '',
        logStream: entry.logStream || '',
        severity: entry.message?.toLowerCase().includes('error') ? 'error' : 
                 entry.message?.toLowerCase().includes('warn') ? 'warning' : 'info'
      };
    });
    
    res.json({
      results: processedLogs,
      metadata: {
        total: processedLogs.length,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    console.error('Error in logs endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint - no auth required
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);

// Export the analyzeLogs callable function
exports.analyzeLogs = analyzeLogs;

// Export the store AWS credentials function
exports.storeAwsSsoCredentials = functions.https.onCall(storeAwsSsoCredentials);

// File upload handler for Storage triggers
exports.handleFileUpload = functions.storage.object().onFinalize(async (object) => {
  try {
    console.log('File upload detected:', object.name);
    
    // Basic validation
    if (!object || !object.name) {
      console.log('Invalid object data');
      return null;
    }
    
    // Simple logging only - no Firestore operations yet
    console.log('File metadata:', {
      name: object.name,
      contentType: object.contentType,
      size: object.size,
      bucket: object.bucket
    });
    
    return null;
  } catch (error) {
    console.error('Error in handleFileUpload:', error);
    return null;
  }
});

// User-related functions
exports.processNewUser = functions.auth.user().onCreate(async (user) => {
  try {
    const email = user.email;
    if (!email) return;
    
    // Add to authorized users if domain matches
    if (email.endsWith('@allisone.ai')) {
      await admin.firestore().collection('authorizedUsers').doc(email).set({
        email: email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        uid: user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLogin: admin.firestore.FieldValue.serverTimestamp(),
        role: 'user' // Default role
      });
      
      console.log(`Added new authorized user: ${email}`);
    }
  } catch (error) {
    console.error('Error processing new user:', error);
  }
});