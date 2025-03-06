import { spawn } from 'child_process';
import { join, resolve, parse, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Improved WSL path conversion
const toWslPath = (windowsPath) => {
  if (process.platform !== 'win32') return windowsPath;
  const driveLetter = windowsPath[0].toLowerCase();
  const pathWithoutDrive = windowsPath.slice(2).replace(/\\/g, '/');
  return `/mnt/${driveLetter}${pathWithoutDrive}`; // Fixed: no double slash
};

// Check if AWS CLI is available
const checkAwsCliAvailability = async () => {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'where aws' : 'which aws';
    exec(command, (error, stdout, stderr) => {
      resolve(!error && stdout.trim().length > 0);
    });
  });
};

// List available AWS profiles
const listAwsProfiles = async () => {
  return new Promise((resolve) => {
    exec('aws configure list-profiles', (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        resolve([]);
      } else {
        resolve(stdout.trim().split(/\r?\n/));
      }
    });
  });
};

// Determine log severity
const determineSeverity = (message) => {
  const lowercaseMessage = (message || '').toLowerCase();
  if (lowercaseMessage.includes('error')) return 'error';
  if (lowercaseMessage.includes('warn')) return 'warning';
  return 'info';
};

// Process and transform logs to ensure consistent format
const processLogs = (rawResults) => {
  try {
    console.log('Processing raw results:', JSON.stringify(rawResults).substring(0, 500));
    
    // Check if this is CloudWatch format (has statistics and results are arrays of field objects)
    if (rawResults.statistics && Array.isArray(rawResults.results) && 
        rawResults.results.length > 0 && Array.isArray(rawResults.results[0])) {
      
      console.log('Detected CloudWatch log format');
      
      // CloudWatch logs format - transform to our application format
      const processedLogs = rawResults.results.map(logEntry => {
        // Extract fields from CloudWatch log format
        let timestamp = '';
        let message = '';
        let logStream = 'unknown';
        
        for (const field of logEntry) {
          if (field.field === '@timestamp') {
            timestamp = field.value;
          } 
          else if (field.field === '@message') {
            message = field.value;
          }
          else if (field.field === '@logStream') {
            logStream = field.value;
          }
        }
        
        // Log a sample of the extracted fields
        if (logEntry === rawResults.results[0]) {
          console.log('Sample log fields extracted:', { timestamp, message, logStream });
        }
        
        return {
          timestamp,  // Keep original timestamp format
          message: message || 'No content', // Provide default if empty
          logStream,
          severity: determineSeverity(message)
        };
      });
      
      return {
        results: processedLogs,
        metadata: {
          total: processedLogs.length,
          timestamp: Date.now()
        }
      };
    } 
    else {
      // Handle standard log format - no changes needed here
      const logsArray = Array.isArray(rawResults.results) 
        ? rawResults.results 
        : [rawResults.results].filter(Boolean);

      const processedLogs = logsArray.map(log => {
        const message = log.message || 'No message';
        const timestamp = log.timestamp || new Date().toISOString();
        const logStream = log.logStream || 'unknown';

        return {
          timestamp,
          message,
          logStream,
          severity: determineSeverity(message)
        };
      });

      return {
        results: processedLogs.slice(0, 5000),
        metadata: {
          total: processedLogs.length,
          timestamp: Date.now()
        }
      };
    }
  } catch (error) {
    console.error('Error processing logs:', error);
    return { results: [], error: 'Failed to process logs', details: error.message };
  }
};

export async function logsHandler(req, res) {
  let { startTime, endTime, locationIds, version, limit = 1000, awsProfile } = req.body;
  
  if (!locationIds?.length || !version) {
    return res.status(400).json({ error: 'Location IDs and version are required' });
  }

  try {
    // Check if AWS CLI is available
    const isAwsCliAvailable = await checkAwsCliAvailability();
    if (!isAwsCliAvailable) {
      return res.status(500).json({ 
        error: 'AWS CLI not found', 
        message: 'Please install AWS CLI and make sure it is in your PATH'
      });
    }

    // Get available AWS profiles
    const profiles = await listAwsProfiles();
    console.log('Available AWS profiles:', profiles);

    // If no profile specified or specified profile doesn't exist, use the first available profile
    if (!awsProfile || !profiles.includes(awsProfile)) {
      if (profiles.length > 0) {
        awsProfile = profiles[0];
        console.log(`Using available AWS profile: ${awsProfile}`);
      } else {
        return res.status(500).json({ 
          error: 'No AWS profiles found', 
          message: 'Please configure AWS CLI with credentials'
        });
      }
    }

    // Check AWS authentication
    console.log('Checking AWS authentication...');
    const awsCheckCmd = `aws sts get-caller-identity --profile ${awsProfile}`;
    console.log('Executing AWS CLI command:', awsCheckCmd);

    try {
      await new Promise((resolve, reject) => {
        exec(awsCheckCmd, (error, stdout, stderr) => {
          if (error) {
            console.error('AWS authentication check failed:', error);
            console.error('AWS CLI error output:');
            console.error(stderr.trim());
            reject(new Error(`Command failed: ${awsCheckCmd}\n\n${stderr.trim()}`));
          } else {
            console.log('Parsed identity:', JSON.parse(stdout.trim()));
            resolve();
          }
        });
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'AWS authentication failed', 
        details: error.message 
      });
    }

    // Find the appropriate script based on the platform
    let scriptPath;
    let scriptArgs;
    
    if (process.platform === 'win32') {
      // On Windows, look for both .sh and .bat versions
      const bashScript = resolve(__dirname, '..', '..', 'cloudwatch.sh');
      const batchScript = resolve(__dirname, '..', '..', 'cloudwatch.bat');
      
      if (existsSync(batchScript)) {
        // Use the .bat file directly if it exists
        scriptPath = batchScript;
        scriptArgs = [
          '--start-time', String(startTime),
          '--end-time', String(endTime),
          '--user-id', locationIds.join(','),
          '--version', version,
          '--limit', String(limit),
          '--profile', awsProfile,
          '--debug'
        ];
      } else {
        // Fall back to the .sh file through WSL
        scriptPath = resolve(__dirname, '..', '..', 'cloudwatch.sh');
        const wslScriptPath = toWslPath(scriptPath);
        
        // On Windows, ensure AWS CLI can be found in WSL
        scriptPath = 'bash';
        scriptArgs = [
          wslScriptPath,
          '--start-time', String(startTime),
          '--end-time', String(endTime),
          '--user-id', locationIds.join(','),
          '--version', version,
          '--limit', String(limit),
          '--profile', awsProfile,
          '--debug'
        ];
      }
    } else {
      // On Mac/Linux, use the .sh script directly
      scriptPath = resolve(__dirname, '..', '..', 'cloudwatch.sh');
      scriptArgs = [
        '--start-time', String(startTime),
        '--end-time', String(endTime),
        '--user-id', locationIds.join(','),
        '--version', version,
        '--limit', String(limit),
        '--profile', awsProfile,
        '--debug'
      ];
    }

    console.log('Script path:', scriptPath);
    console.log('Script args:', scriptArgs);
    console.log('Is Windows?', process.platform === 'win32');

    const spawnOptions = {
      shell: process.platform === 'win32',
      stdio: ['inherit', 'pipe', 'pipe'], // Changed to pipe stdout and stderr
      windowsVerbatimArguments: process.platform === 'win32'
    };

    const child = spawn(scriptPath, scriptArgs, spawnOptions);

    let stdout = '';
    let stderr = '';

    // Collect stdout data
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    // Collect stderr data
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      console.error('stderr:', data.toString());
    });

    child.on('close', (code) => {
      if (code === 0) {
        try {
          // Parse the raw result
          const rawResult = JSON.parse(stdout);
          
          // Process and transform logs
          const processedResult = processLogs(rawResult);
          
          // Respond with processed logs
          res.json(processedResult);
        } catch (error) {
          console.error('Error parsing result:', error);
          res.status(500).json({ 
            error: 'Failed to parse results',
            stdout: stdout,
            parseError: error.message
          });
        }
      } else {
        console.error(`Script failed with code ${code}`);
        console.error('Error details:', stdout);
        
        // Try to parse stdout as JSON if possible
        try {
          const errorJson = JSON.parse(stdout);
          res.status(500).json(errorJson);
        } catch (parseError) {
          // If stdout isn't valid JSON, return a structured error
          res.status(500).json({ 
            error: `Script failed with code ${code}`,
            stdout: stdout,
            stderr: stderr
          });
        }
      }
    });

    child.on('error', (err) => {
      console.error('Spawn error:', err);
      res.status(500).json({ error: err.message });
    });
    
  } catch (error) {
    console.error('Fatal error:', error);
    res.status(500).json({ error: error.message });
  }
};