const { exec } = require('child_process');
const functions = require('firebase-functions');

// Security: Sanitize inputs to prevent command injection
const sanitizeProfileName = (profile) => {
  // Only allow alphanumeric characters and hyphens
  return (profile || '').replace(/[^a-zA-Z0-9-]/g, '');
};

// Check AWS authentication status
exports.checkAwsAuth = async (req, res) => {
  try {
    // Get AWS profile - either from request or environment config
    let awsProfile = req.query.profile || functions.config().aws?.profile || 'prod';
    
    // Sanitize profile name to prevent command injection
    awsProfile = sanitizeProfileName(awsProfile);
    
    console.log(`Checking AWS authentication for profile: ${awsProfile}`);
    
    exec(`aws sts get-caller-identity --profile ${awsProfile}`, (error, stdout, stderr) => {
      if (error) {
        console.error('AWS auth check failed:', error);
        return res.status(500).json({ 
          isAuthenticated: false,
          error: 'Failed to authenticate with AWS'
        });
      }
      
      try {
        const identity = JSON.parse(stdout);
        res.json({ 
          isAuthenticated: true,
          error: null,
          identity: identity.Arn 
        });
      } catch (parseError) {
        console.error('Error parsing AWS response:', parseError);
        res.status(500).json({ 
          isAuthenticated: false,
          error: 'Failed to parse AWS response'
        });
      }
    });
  } catch (error) {
    console.error('Error in AWS auth check:', error);
    res.status(500).json({ 
      isAuthenticated: false,
      error: 'Internal server error'
    });
  }
};

// Login to AWS SSO
exports.loginAwsSso = async (req, res) => {
  try {
    // Get AWS profile with sanitization
    let awsProfile = req.body.profile || functions.config().aws?.profile || 'prod';
    awsProfile = sanitizeProfileName(awsProfile);
    
    console.log(`Attempting AWS SSO login for profile: ${awsProfile}`);
    
    exec(`aws sso login --profile ${awsProfile}`, (error, stdout, stderr) => {
      if (error) {
        console.error('AWS SSO login failed:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to login with AWS SSO'
        });
      }
      
      res.json({
        success: true,
        message: 'AWS SSO login successful'
      });
    });
  } catch (error) {
    console.error('Error in AWS login:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};