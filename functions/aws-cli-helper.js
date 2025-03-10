// functions/aws-cli-helper.js
const admin = require('firebase-admin');
const AWS = require('aws-sdk');
const functions = require('firebase-functions');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');

/**
 * Initiates AWS SSO login process via CLI
 * This function generates a session ID and instructions for the user
 */
exports.initiateAwsCliLogin = async (data, context) => {
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
    
    // Get profile from request or use default
    const profile = data?.profile || 'default';
    
    // Store session info in Firestore
    await admin.firestore()
      .collection('awsSsoSessions')
      .doc(sessionId)
      .set({
        userId: context.auth.uid,
        email: context.auth.token.email,
        status: 'pending',
        profile: profile,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return { 
      success: true,
      sessionId,
      message: `Please run 'aws sso login --profile ${profile}' in your terminal, then click 'Verify Connection'`,
      statusUrl: `/api/aws-sso-status?sessionId=${sessionId}`
    };
  } catch (error) {
    console.error('Error initiating AWS CLI login:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
};
// New function in aws-cli-helper.js or a new file
exports.systemCheckAwsConnection = functions.https.onCall(async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to check AWS connection'
    );
  }

  try {
    // Create STS service object to check credentials
    const sts = new AWS.STS();
    
    try {
      // Verify credentials by calling getCallerIdentity
      const identity = await sts.getCallerIdentity().promise();
      
      return {
        isAuthenticated: true,
        identity: identity.Arn,
        message: "AWS credentials are valid"
      };
    } catch (awsError) {
      console.error('AWS connection check failed:', awsError);
      
      return {
        isAuthenticated: false,
        error: "Failed to verify AWS credentials",
        message: "Please ensure you are logged in with AWS SSO"
      };
    }
  } catch (error) {
    console.error('Error checking AWS connection:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
/**
 * Checks if AWS CLI credentials are valid
 * This function is called after the user completes the CLI login
 */
exports.verifyAwsCliCredentials = async (data, context) => {
  // Ensure user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to verify AWS credentials'
    );
  }

  try {
    const { sessionId } = data;
    
    if (!sessionId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Session ID is required'
      );
    }
    
    // Get session from Firestore
    const sessionDoc = await admin.firestore()
      .collection('awsSsoSessions')
      .doc(sessionId)
      .get();
    
    if (!sessionDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Session not found'
      );
    }
    
    const session = sessionDoc.data();
    
    // Update session status
    await sessionDoc.ref.update({
      verificationAttemptedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Create STS service object to check credentials
    // The AWS SDK will automatically use credentials from the shared credentials file
    const sts = new AWS.STS();
    
    try {
      // Verify credentials by calling getCallerIdentity
      const identity = await sts.getCallerIdentity().promise();
      
      // Store successful connection in Firestore
      await admin.firestore()
        .collection('systemConfig')
        .doc('awsConnection')
        .set({
          isConnected: true,
          lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          identity: identity.Arn,
          profile: session.profile
        });
      
      // Update session status
      await sessionDoc.ref.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        identity: identity.Arn
      });
      
      return {
        success: true,
        isAuthenticated: true,
        identity: identity.Arn,
        message: "AWS credentials verified successfully"
      };
    } catch (awsError) {
      console.error('AWS credential verification failed:', awsError);
      
      // Update session with error
      await sessionDoc.ref.update({
        status: 'failed',
        error: awsError.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return {
        success: false,
        isAuthenticated: false,
        error: awsError.message,
        message: "Failed to verify AWS credentials. Please make sure 'aws sso login' completed successfully."
      };
    }
  } catch (error) {
    console.error('Error verifying AWS credentials:', error);
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
    
    // Return session status
    return res.json({
      status: session.status,
      credentials: session.status === 'completed' ? {
        isAuthenticated: true,
        identity: session.identity || null
      } : null,
      error: session.error || null
    });
  } catch (error) {
    console.error('Error checking AWS SSO status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};