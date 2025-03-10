const { spawn } = require('child_process');
const { join, resolve } = require('path');
const { existsSync } = require('fs');
const { exec } = require('child_process');
const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Security: Sanitize inputs to prevent injection
const sanitizeInputs = (inputs) => {
  const safe = {};
  
  // Validate and sanitize locationIds (must be numbers)
  if (Array.isArray(inputs.locationIds)) {
    safe.locationIds = inputs.locationIds
      .map(id => String(id).replace(/[^0-9]/g, ''))
      .filter(id => id.length > 0);
  } else {
    safe.locationIds = [];
  }
  
  // Sanitize version (alphanumeric, dots, dashes only)
  safe.version = String(inputs.version || '').replace(/[^a-zA-Z0-9.-]/g, '');
  
  // Validate timestamps are numbers
  safe.startTime = Number(inputs.startTime) || Date.now() - (24 * 60 * 60 * 1000);
  safe.endTime = Number(inputs.endTime) || Date.now();
  
  // Sanitize limit (must be a number between 1-5000)
  safe.limit = Math.min(Math.max(Number(inputs.limit) || 1000, 1), 5000);
  
  // Sanitize AWS profile
  safe.awsProfile = String(inputs.awsProfile || 'prod').replace(/[^a-zA-Z0-9-]/g, '');
  
  return safe;
};

// Process and transform logs securely
const processLogs = (rawResults) => {
  try {
    // Process logic remains the same as in your original code
    // This handles different log formats and transforms them consistently
    
    return {
      results: processedLogs,
      metadata: {
        total: processedLogs.length,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.error('Error processing logs:', error);
    return { results: [], error: 'Failed to process logs' };
  }
};

// Main logs handler with security enhancements
exports.logsHandler = async (req, res) => {
  try {
    // Security: Validate and sanitize all inputs
    const safeInputs = sanitizeInputs(req.body);
    
    // Security: Log request for audit
    await admin.firestore().collection('requestLogs').add({
      type: 'logQuery',
      user: req.user.uid,
      email: req.user.email,
      params: safeInputs,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Check cache first (optimization)
    const cacheKey = `logs-${safeInputs.locationIds.join('-')}-${safeInputs.startTime}-${safeInputs.endTime}-${safeInputs.version}`;
    const cacheRef = admin.firestore().collection('queryCache').doc(cacheKey);
    const cacheDoc = await cacheRef.get();
    
    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data();
      const isCacheValid = Date.now() - cacheData.timestamp < 5 * 60 * 1000;
      if (isCacheValid) {
        return res.json(cacheData.results);
      }
    }
    
    // Standard CloudWatch query logic with sanitized inputs
    const scriptPath = resolve(__dirname, 'cloudwatch.sh');
    
    // Security: Use sanitized inputs for script arguments
    const scriptArgs = [
      '--start-time', String(safeInputs.startTime),
      '--end-time', String(safeInputs.endTime),
      '--user-id', safeInputs.locationIds.join(','),
      '--version', safeInputs.version,
      '--limit', String(safeInputs.limit),
      '--profile', safeInputs.awsProfile,
      '--debug'
    ];
    
    console.log('Script path:', scriptPath);
    console.log('Script args:', scriptArgs);
    
    const child = spawn(scriptPath, scriptArgs, {
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      console.error('stderr:', data.toString());
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        try {
          // Parse and process results
          const rawResult = JSON.parse(stdout);
          const processedResult = processLogs(rawResult);
          
          // Cache results for future requests
          cacheRef.set({
            timestamp: Date.now(),
            results: processedResult
          });
          
          res.json(processedResult);
        } catch (error) {
          console.error('Error parsing result:', error);
          res.status(500).json({ 
            error: 'Failed to parse results'
          });
        }
      } else {
        console.error(`Script failed with code ${code}`);
        res.status(500).json({ 
          error: `Script failed with code ${code}`
        });
      }
    });
    
    child.on('error', (err) => {
      console.error('Spawn error:', err);
      res.status(500).json({ error: err.message });
    });
    
  } catch (error) {
    console.error('Fatal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};