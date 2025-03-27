import { CloudWatchLogsClient, StartQueryCommand, GetQueryResultsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { fromEnv, fromIni, fromSSO } from '@aws-sdk/credential-providers';

// Create a function to get credentials with better error handling
const getCredentials = async (profileName) => {
  try {
    console.log(`Attempting to load SSO credentials for profile: ${profileName}`);
    try {
      // Try SSO credentials first
      return fromSSO({ profile: profileName });
    } catch (ssoError) {
      console.error(`Failed to load SSO credentials for profile ${profileName}:`, ssoError);
      
      // Fall back to profile credentials
      console.log(`Attempting to load profile credentials: ${profileName}`);
      try {
        return fromIni({ profile: profileName });
      } catch (profileError) {
        console.error(`Failed to load credentials from profile ${profileName}:`, profileError);
        
        // Fall back to environment variables as last resort
        console.log('Falling back to environment variable credentials');
        try {
          return fromEnv();
        } catch (envError) {
          console.error('Could not load credentials from environment:', envError);
          throw new Error(`AWS credentials not found for profile ${profileName} or environment variables`);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to load any AWS credentials:`, error);
    throw new Error(`AWS credentials not available: ${error.message}`);
  }
};

export const checkAwsCli = async () => {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    await execFileAsync('aws', ['--version']);
    return true;
  } catch (error) {
    console.error('AWS CLI check failed:', error);
    return false;
  }
};

export const listAwsProfiles = async () => {
  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync('aws', ['configure', 'list-profiles']);
    
    // Trim whitespace and carriage returns from each profile name
    return stdout.split('\n')
      .map(profile => profile.trim())
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to list AWS profiles:', error);
    return [];
  }
};

export const determineLogSeverity = (message) => {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('error') || lowerMessage.includes('exception')) {
    return 'error';
  } else if (lowerMessage.includes('warning') || lowerMessage.includes('warn')) {
    return 'warning';
  }
  return 'info';
};

export const processLogs = (logs) => {
  return logs.map(log => ({
    ...log,
    severity: determineLogSeverity(log.message),
    timestamp: new Date(log.timestamp).toISOString()
  }));
};

export const logsHandler = async (req, res) => {
  try {
    const { startTime, endTime, locationIds, profile = 'Auto-detect', version } = req.body;
    
    console.log('Logs request received:', {
      startTime,
      endTime,
      locationIds,
      profile,
      version,
      limit: req.body.limit
    });
    
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required parameters: startTime and endTime' });
    }

    const hasAwsCli = await checkAwsCli();
    if (!hasAwsCli) {
      return res.status(400).json({ error: 'AWS CLI is not installed or not accessible' });
    }

    // Get available profiles
    const availableProfiles = await listAwsProfiles();
    console.log('Available AWS profiles:', availableProfiles);
    
    // Handle Auto-detect profile or use specified profile
    let effectiveProfile = profile;
    if (profile === 'Auto-detect') {
      if (availableProfiles.length > 0) {
        // Prefer 'prod' profile if available, otherwise use first available
        effectiveProfile = availableProfiles.includes('prod') ? 'prod' : availableProfiles[0];
        console.log(`Auto-detected AWS profile: ${effectiveProfile}`);
      } else {
        console.log('No AWS profiles found, falling back to default');
        effectiveProfile = 'default';
      }
    }
    
    // Check if provided profile exists
    if (profile !== 'Auto-detect' && !availableProfiles.includes(profile)) {
      console.warn(`Specified profile '${profile}' not found in available profiles, using it anyway`);
    }

    try {
      // Get credentials explicitly first
      const credentials = await getCredentials(effectiveProfile);
      
      // Create CloudWatch Logs client with explicit credentials
      const cloudWatchClient = new CloudWatchLogsClient({ 
        region: 'eu-west-3',
        credentials
      });

      console.log(`Using AWS profile: ${effectiveProfile} and region: eu-west-3 for CloudWatch query`);

      // Construct the query
      const queryString = `
        fields @timestamp, @message, @logStream
        | filter @message like /Treatment created successfully/
        ${locationIds && locationIds.length > 0 ? 
          `| filter ${locationIds.map(id => `@logStream like '[${id}]'`).join(' or ')}` 
          : ''}
        ${version ? `| filter @logStream like '[${version}]'` : ''}
        | sort @timestamp desc
        | limit ${req.body.limit || 1000}
      `;

      // Start the query
      const startQueryCommand = new StartQueryCommand({
        logGroupName: 'allisone-plus-log-group',
        startTime: typeof startTime === 'number' && startTime < 9999999999 
          ? startTime * 1000  // Convert seconds to milliseconds if needed
          : new Date(startTime).getTime(),
        endTime: typeof endTime === 'number' && endTime < 9999999999
          ? endTime * 1000  // Convert seconds to milliseconds if needed
          : new Date(endTime).getTime(),
        queryString,
        limit: req.body.limit || 100
      });

      console.log(`Query time range: ${new Date(startQueryCommand.input.startTime)} to ${new Date(startQueryCommand.input.endTime)}`);
      console.log(`Query string: ${queryString}`);

      const queryResponse = await cloudWatchClient.send(startQueryCommand);
      const queryId = queryResponse.queryId;

      // Poll for results
      let queryComplete = false;
      let results = [];
      let attempts = 0;
      const maxAttempts = 10;

      while (!queryComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const getResultsCommand = new GetQueryResultsCommand({
          queryId
        });

        const resultsResponse = await cloudWatchClient.send(getResultsCommand);
        
        if (resultsResponse.status === 'Complete') {
          queryComplete = true;
          results = resultsResponse.results;
        } else if (resultsResponse.status === 'Failed') {
          throw new Error('Query failed: ' + resultsResponse.status);
        }
        
        attempts++;
      }

      if (!queryComplete) {
        throw new Error('Query timed out');
      }

      // Process the results
      const processedLogs = processLogs(results.map(row => ({
        timestamp: row.find(f => f.field === '@timestamp')?.value,
        message: row.find(f => f.field === '@message')?.value,
        logStream: row.find(f => f.field === '@logStream')?.value
      })));

      // If no logs found, add a fallback message
      if (processedLogs.length === 0) {
        console.log('No logs found in CloudWatch, adding fallback message');
        processedLogs.push({
          timestamp: new Date().toISOString(),
          message: `No logs found for the specified criteria. This is a fallback message to indicate the query was successful but returned no results.`,
          logStream: `[${locationIds ? locationIds[0] : 'unknown'}][${version || 'unknown'}]`,
          severity: 'info'
        });
      }

      res.json(processedLogs);
    } catch (credentialError) {
      console.error('AWS credential error:', credentialError);
      return res.status(401).json({ 
        error: "AWS authentication failed",
        details: credentialError.message,
        fix: "Please check your AWS credentials and make sure you're logged in with 'aws sso login'"
      });
    }
  } catch (error) {
    console.error('Error in logsHandler:', error);
    res.status(500).json({ error: error.message });
  }
};