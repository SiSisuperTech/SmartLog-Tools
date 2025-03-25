import { CloudWatchLogsClient, StartQueryCommand, GetQueryResultsCommand } from '@aws-sdk/client-cloudwatch-logs';

const client = new CloudWatchLogsClient({ profile: 'prod' });

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
    return stdout.split('\n').filter(Boolean);
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
    const { startTime, endTime, locationIds, profile = 'prod' } = req.body;
    
    if (!startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required parameters: startTime and endTime' });
    }

    const hasAwsCli = await checkAwsCli();
    if (!hasAwsCli) {
      return res.status(500).json({ error: 'AWS CLI is not installed or not accessible' });
    }

    // Create CloudWatch Logs client
    const cloudWatchClient = new CloudWatchLogsClient({ profile });

    // Construct the query
    const queryString = `
      fields @timestamp, @message
      | filter @message like /treatment created/
      | sort @timestamp desc
      | limit 100
    `;

    // Start the query
    const startQueryCommand = new StartQueryCommand({
      logGroupName: '/aws/lambda/prod-api',
      startTime: new Date(startTime).getTime(),
      endTime: new Date(endTime).getTime(),
      queryString,
      limit: 100
    });

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
      message: row.find(f => f.field === '@message')?.value
    })));

    res.json(processedLogs);
  } catch (error) {
    console.error('Error in logsHandler:', error);
    res.status(500).json({ error: error.message });
  }
};