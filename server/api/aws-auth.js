// server/api/aws-auth.js
import { execFile } from 'child_process';
import { promisify } from 'util';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

const execFileAsync = promisify(execFile);

export const checkAwsAuth = async () => {
  console.log('Checking AWS authentication...');
  try {
    // Create STS client
    const stsClient = new STSClient({ profile: 'prod' });
    
    // Get caller identity
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);
    
    console.log('AWS Identity:', response);
    
    return { 
      isAuthenticated: true,
      error: null,
      identity: response.Arn 
    };
  } catch (error) {
    console.error('AWS authentication check failed:', error);
    console.error('Error details:', error.message);
    return { 
      isAuthenticated: false,
      error: 'Failed to authenticate with AWS: ' + error.message,
      identity: null 
    };
  }
};

export const loginAwsSso = async () => {
  console.log('Attempting AWS SSO login...');
  try {
    console.log('Executing AWS CLI command: aws sso login --profile prod');
    const { stdout, stderr } = await execFileAsync('aws', ['sso', 'login', '--profile', 'prod']);
    
    if (stderr) {
      console.error('AWS CLI command stderr:', stderr);
    }
    
    console.log('AWS CLI command stdout:', stdout);
    
    return {
      success: true,
      message: 'AWS SSO login successful'
    };
  } catch (error) {
    console.error('AWS SSO login failed:', error);
    console.error('Error details:', error.message);
    if (error.stderr) {
      console.error('AWS CLI error output:', error.stderr);
    }
    return {
      success: false,
      error: 'Failed to login with AWS SSO: ' + error.message
    };
  }
};