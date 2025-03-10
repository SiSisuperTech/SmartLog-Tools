// functions/aws-sso-browser.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const open = require('open');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

// This file contains functions to handle browser-based AWS SSO login

/**
 * Generate a unique login session and return URL for the client
 */
exports.initiateAwsSsoLogin = async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to initiate AWS SSO login'
    );
  }

  try {
    // Generate unique session ID
    const sessionId = uuidv4();
    
    // Store session info in Firestore
    await admin.firestore()
      .collection('awsSsoSessions')
      .doc(sessionId)
      .set({
        userId: context.auth.uid,
        email: context.auth.token.email,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        profile: data.profile || 'prod'
      });

    // Return session ID to client
    return { 
      sessionId,
      // This is the URL the client will poll to check login status
      statusUrl: `/api/aws-sso-status?sessionId=${sessionId}`
    };
  } catch (error) {
    console.error('Error initiating AWS SSO login:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
};

/**
 * Check the status of an AWS SSO login session
 */
exports.checkAwsSsoStatus = async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Get session from Firestore
    const sessionDoc = await admin.firestore()
      .collection('awsSsoSessions')
      .doc(sessionId)
      .get();
    
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const session = sessionDoc.data();
    
    return res.json({
      status: session.status,
      credentials: session.status === 'completed' ? {
        isAuthenticated: true,
        identity: session.identity || null
      } : null
    });
  } catch (error) {
    console.error('Error checking AWS SSO status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * This function runs on a schedule or is triggered manually to process pending SSO login sessions
 */
exports.processAwsSsoSessions = async (context) => {
  try {
    // Find pending sessions
    const pendingSessions = await admin.firestore()
      .collection('awsSsoSessions')
      .where('status', '==', 'pending')
      .where('createdAt', '>', admin.firestore.Timestamp.fromMillis(Date.now() - 5 * 60 * 1000)) // Last 5 minutes
      .get();
    
    console.log(`Found ${pendingSessions.size} pending AWS SSO sessions to process`);
    
    if (pendingSessions.empty) {
      return { processed: 0 };
    }
    
    let processed = 0;
    
    // Process each pending session
    for (const doc of pendingSessions.docs) {
      const session = doc.data();
      const sessionId = doc.id;
      
      // Update status to processing
      await doc.ref.update({
        status: 'processing',
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      try {
        // Launch browser for AWS SSO login
        // Note: This requires the function to run in a local environment or server with browser access
        const profile = session.profile || 'prod';
        console.log(`Opening AWS SSO login for profile: ${profile}`);
        
        // Open the browser for SSO login
        await open(`https://us-east-1.console.aws.amazon.com/singlesignon/home`);
        
        // Run AWS SSO login command
        await new Promise((resolve, reject) => {
          exec(`aws sso login --profile ${profile}`, (error, stdout, stderr) => {
            if (error) {
              console.error(`AWS SSO login error for session ${sessionId}:`, error);
              reject(error);
              return;
            }
            
            console.log(`AWS SSO login success for session ${sessionId}`);
            resolve(stdout);
          });
        });
        
        // Get credentials from profile
        const credentials = await getCredentialsFromProfile(profile);
        
        // Store credentials in Firestore
        await admin.firestore()
          .collection('systemConfig')
          .doc('awsCredentials')
          .set({
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
            expiration: credentials.expiration,
            region: credentials.region || 'us-east-1',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: session.email
          });
        
        // Update session status
        await doc.ref.update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          identity: credentials.identity
        });
        
        processed++;
      } catch (error) {
        console.error(`Error processing AWS SSO session ${sessionId}:`, error);
        
        // Update session with error
        await doc.ref.update({
          status: 'error',
          error: error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    
    return { processed };
  } catch (error) {
    console.error('Error processing AWS SSO sessions:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
};

/**
 * Helper function to get AWS credentials from the cached profile
 */
async function getCredentialsFromProfile(profile) {
  return new Promise((resolve, reject) => {
    exec(`aws sts get-caller-identity --profile ${profile}`, async (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to get AWS identity: ${error.message}`));
        return;
      }
      
      try {
        const identity = JSON.parse(stdout);
        
        // Get credentials from AWS CLI cache
        exec(`cat ~/.aws/cli/cache/*.json`, (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Failed to read AWS cached credentials: ${error.message}`));
            return;
          }
          
          try {
            // Find the most recent credential file
            const credentialsFiles = stdout.split('}\n{').map(part => {
              if (!part.startsWith('{')) part = '{' + part;
              if (!part.endsWith('}')) part = part + '}';
              return JSON.parse(part);
            });
            
            if (credentialsFiles.length === 0) {
              reject(new Error('No AWS cached credentials found'));
              return;
            }
            
            // Sort by expiration date and get the latest
            const latestCredentials = credentialsFiles
              .sort((a, b) => new Date(b.Credentials.Expiration) - new Date(a.Credentials.Expiration))[0];
            
            resolve({
              accessKeyId: latestCredentials.Credentials.AccessKeyId,
              secretAccessKey: latestCredentials.Credentials.SecretAccessKey,
              sessionToken: latestCredentials.Credentials.SessionToken,
              expiration: latestCredentials.Credentials.Expiration,
              region: 'us-east-1', // Default region
              identity: identity.Arn
            });
          } catch (parseError) {
            reject(new Error(`Failed to parse AWS cached credentials: ${parseError.message}`));
          }
        });
      } catch (parseError) {
        reject(new Error(`Failed to parse AWS identity: ${parseError.message}`));
      }
    });
  });
}