// functions/aws-credentials.js
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const AWS = require('aws-sdk');

const secretClient = new SecretManagerServiceClient();

exports.getAwsCredentials = async (profile = 'prod') => {
  try {
    // Get AWS credentials from Secret Manager instead of local files
    const secretName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/aws-credentials-${profile}/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name: secretName });
    const credentialsJson = version.payload.data.toString();
    const credentials = JSON.parse(credentialsJson);
    
    // Configure AWS SDK with retrieved credentials
    AWS.config.update({
      region: credentials.region || 'us-east-1',
      credentials: new AWS.Credentials({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken
      })
    });
    
    return true;
  } catch (error) {
    console.error('Error retrieving AWS credentials:', error);
    throw new Error('Failed to retrieve AWS credentials');
  }
};