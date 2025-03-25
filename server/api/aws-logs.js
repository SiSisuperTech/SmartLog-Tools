import { execFile } from 'child_process';
import { promisify } from 'util';
import { checkAwsAuth } from './aws-auth.js';

const execFileAsync = promisify(execFile);

/**
 * Query CloudWatch logs for X-ray treatment data
 * @param {Object} options Query options
 * @param {number} options.startTime Start time in milliseconds
 * @param {number} options.endTime End time in milliseconds
 * @param {string[]} options.locationIds Location IDs to query
 * @param {string} options.version Software version to filter logs
 * @param {number} [options.limit=1000] Maximum number of logs to return
 * @returns {Promise<Object>} CloudWatch query results
 */
export const queryCloudWatchLogs = async (options) => {
  console.log('Querying CloudWatch logs with options:', options);
  
  const { startTime, endTime, locationIds, version, limit = 1000 } = options;
  
  // Validate required parameters
  if (!startTime || !endTime || !locationIds?.length || !version) {
    throw new Error('Missing required parameters for CloudWatch query');
  }
  
  try {
    // Check AWS authentication first
    const authStatus = await checkAwsAuth();
    if (!authStatus.isAuthenticated) {
      throw new Error('AWS authentication required: ' + (authStatus.error || 'Not authenticated'));
    }
    
    // Convert times to seconds if they're in milliseconds
    const startTimeSec = startTime > 9999999999 ? Math.floor(startTime / 1000) : startTime;
    const endTimeSec = endTime > 9999999999 ? Math.floor(endTime / 1000) : endTime;
    
    // Create a query string for CloudWatch Logs Insights
    // Simplify the query to make it more reliable - we'll filter the results in our code
    const queryString = `
      fields @timestamp, @message
      | filter @message like "X-ray" or @message like "PANORAMIC" or @message like "PERIAPICAL" or @message like "createTreatment" 
      | sort @timestamp desc
      | limit ${limit}
    `;
    
    console.log('Using simplified CloudWatch query:', queryString);
    
    // Execute AWS CLI command to query logs
    // Using aws logs start-query and then aws logs get-query-results
    const startQueryResponse = await execFileAsync('aws', [
      'logs',
      'start-query',
      '--log-group-name', 'allisone-plus-log-group',
      '--start-time', startTimeSec.toString(),
      '--end-time', endTimeSec.toString(),
      '--query-string', queryString,
      '--profile', 'prod',
      '--region', 'eu-west-3'
    ]);
    
    // Parse the response to get the query ID
    const queryData = JSON.parse(startQueryResponse.stdout);
    const queryId = queryData.queryId;
    
    if (!queryId) {
      throw new Error('Failed to get query ID from CloudWatch');
    }
    
    console.log('CloudWatch query started with ID:', queryId);
    
    // Poll for results (with timeout)
    let results = null;
    let attempts = 0;
    const maxAttempts = 30;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Polling for results (attempt ${attempts}/${maxAttempts})...`);
      
      // Small delay between polling attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get query results
      const resultsResponse = await execFileAsync('aws', [
        'logs',
        'get-query-results',
        '--query-id', queryId,
        '--profile', 'prod',
        '--region', 'eu-west-3'
      ]);
      
      const resultsData = JSON.parse(resultsResponse.stdout);
      
      // Check if query is complete
      if (resultsData.status === 'Complete') {
        results = resultsData;
        break;
      } else if (resultsData.status === 'Failed') {
        throw new Error('CloudWatch query failed: ' + JSON.stringify(resultsData));
      }
    }
    
    if (!results) {
      throw new Error(`CloudWatch query timed out after ${maxAttempts} attempts`);
    }
    
    console.log(`Retrieved ${results.results?.length || 0} log entries from CloudWatch`);
    if (results.results && results.results.length > 0) {
      console.log('Sample log entry format:', JSON.stringify(results.results[0], null, 2));
      
      // Check if the log entries are in the expected format
      const firstEntry = results.results[0];
      if (Array.isArray(firstEntry)) {
        console.log('Log entries are in array format with fields');
        const fields = firstEntry.map((field) => field.field);
        console.log('Available fields:', fields);
      } else if (typeof firstEntry === 'object' && firstEntry !== null) {
        console.log('Log entries are in object format with properties');
        console.log('Available properties:', Object.keys(firstEntry));
      } else {
        console.log('Unexpected log entry format type:', typeof firstEntry);
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error querying CloudWatch logs:', error);
    throw error;
  }
};

/**
 * HTTP handler for CloudWatch logs API requests
 */
export const handleLogRequest = async (req, res) => {
  try {
    // Extract parameters from request body
    const { startTime, endTime, locationIds, version, limit } = req.body;
    
    // Validate required parameters
    if (!startTime || !endTime || !locationIds?.length || !version) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'startTime, endTime, locationIds, and version are required'
      });
    }
    
    // Query CloudWatch logs
    const results = await queryCloudWatchLogs({
      startTime,
      endTime,
      locationIds,
      version,
      limit
    });
    
    // Return results to client
    res.json(results);
  } catch (error) {
    console.error('Error handling log request:', error);
    res.status(500).json({
      error: 'Failed to query logs',
      message: error.message
    });
  }
}; 