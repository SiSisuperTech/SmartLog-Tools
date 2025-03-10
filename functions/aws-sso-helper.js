// functions/aws-sso-helper.js
const admin = require('firebase-admin');
const AWS = require('aws-sdk');
const functions = require('firebase-functions');

/**
 * Get temporary credentials from Firestore that were created by SSO
 * This is populated by a separate process that runs locally with browser access
 */
exports.getAwsSsoCredentials = async () => {
  try {
    // Get credentials from Firestore
    const credentialDoc = await admin.firestore()
      .collection('systemConfig')
      .doc('awsCredentials')
      .get();
    
    if (!credentialDoc.exists) {
      console.error('AWS SSO credentials not found in Firestore');
      return false;
    }
    
    const credentials = credentialDoc.data();
    
    // Check if credentials are expired
    if (credentials.expiration && new Date(credentials.expiration) < new Date()) {
      console.error('AWS SSO credentials have expired. Need refresh.');
      return false;
    }
    
    // Configure AWS SDK with credentials
    AWS.config.update({
      region: credentials.region || 'us-east-1',
      credentials: new AWS.Credentials({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken
      })
    });
    
    console.log('AWS SSO credentials configured successfully');
    return true;
  } catch (error) {
    console.error('Error retrieving AWS SSO credentials:', error);
    return false;
  }
};

/**
 * Store SSO credentials in Firestore (called from admin dashboard)
 */
exports.storeAwsSsoCredentials = async (data, context) => {
  // Security check
  if (!context.auth || !context.auth.token.email.endsWith('@allisone.ai')) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Not authorized to update AWS credentials'
    );
  }
  
  try {
    const { accessKeyId, secretAccessKey, sessionToken, expiration, region } = data;
    
    // Validate required fields
    if (!accessKeyId || !secretAccessKey || !sessionToken || !expiration) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required credential fields'
      );
    }
    
    // Store credentials in Firestore
    await admin.firestore()
      .collection('systemConfig')
      .doc('awsCredentials')
      .set({
        accessKeyId,
        secretAccessKey,
        sessionToken,
        expiration,
        region: region || 'us-east-1',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: context.auth.token.email
      });
    
    return { success: true };
  } catch (error) {
    console.error('Error storing AWS SSO credentials:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
};