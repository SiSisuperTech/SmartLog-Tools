// functions/analyze-logs.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Analyze log entries and generate insights
 * Call this function after uploading logs
 */
exports.analyzeLogs = functions.https.onCall(async (data, context) => {s
  // Security check
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  try {
    const { logId } = data;
    if (!logId) {
      throw new functions.https.HttpsError('invalid-argument', 'Log ID is required');
    }

    // Get the log document
    const logDoc = await admin.firestore().collection('uploadedLogs').doc(logId).get();
    
    if (!logDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Log document not found');
    }
    
    // Get log entries from subcollection
    const entriesSnapshot = await admin.firestore()
      .collection('uploadedLogs')
      .doc(logId)
      .collection('entries')
      .get();

    if (entriesSnapshot.empty) {
      throw new functions.https.HttpsError('not-found', 'No log entries found');
    }

    // Extract log entries
    const entries = entriesSnapshot.docs.map(doc => doc.data());

    // Perform analysis
    const analysis = {
      // Count by severity
      severity: {
        error: entries.filter(entry => entry.severity === 'error').length,
        warning: entries.filter(entry => entry.severity === 'warning').length,
        info: entries.filter(entry => entry.severity === 'info').length
      },

      // Count errors over time (by hour)
      timeDistribution: calculateTimeDistribution(entries),

      // Find common error patterns
      commonPatterns: findCommonPatterns(entries),

      // Calculate error rate
      errorRate: entries.filter(entry => entry.severity === 'error').length / entries.length,

      // Example analysis summary
      mistralAnalysis: generateAnalysisSummary(entries)
    };

    // Store analysis results
    await admin.firestore()
      .collection('uploadedLogs')
      .doc(logId)
      .update({
        analysis,
        analyzed: true,
        analyzedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    return { success: true, analysis };
  } catch (error) {
    console.error('Error analyzing logs:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Calculate time distribution of logs by hour
 */
function calculateTimeDistribution(entries) {
  const hourCounts = {};
  
  entries.forEach(entry => {
    if (entry.timestamp) {
      try {
        const date = new Date(entry.timestamp);
        const hour = date.getUTCHours();
        
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      } catch (error) {
        // Skip entries with invalid timestamps
      }
    }
  });
  
  // Convert to array format for easy charting
  return Object.entries(hourCounts).map(([hour, count]) => ({
    hour: parseInt(hour),
    count
  })).sort((a, b) => a.hour - b.hour);
}

/**
 * Find common patterns in log messages
 */
function findCommonPatterns(entries) {
  const patterns = {};
  
  // Focus on error entries
  const errorEntries = entries.filter(entry => entry.severity === 'error');
  
  errorEntries.forEach(entry => {
    if (!entry.message) return;
    
    // Extract potential error patterns
    const errorTypes = [
      // Common exceptions
      /Exception: ([\w\.]+)/i,
      /Error: ([\w\.]+)/i,
      // Stack traces beginning
      /at ([^(]+)\(/i,
      // Failed operations
      /Failed to ([^:]+)/i,
      // HTTP errors
      /(\d{3}) [A-Z]+ /i
    ];
    
    for (const regex of errorTypes) {
      const match = entry.message.match(regex);
      if (match && match[1]) {
        const pattern = match[1].trim();
        patterns[pattern] = (patterns[pattern] || 0) + 1;
      }
    }
  });
  
  // Convert to array and sort by count (descending)
  return Object.entries(patterns)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 patterns
}

/**
 * Generate a basic analysis summary
 */
function generateAnalysisSummary(entries) {
  const totalEntries = entries.length;
  const errorCount = entries.filter(entry => entry.severity === 'error').length;
  const warningCount = entries.filter(entry => entry.severity === 'warning').length;
  const errorRate = (errorCount / totalEntries * 100).toFixed(2);
  
  return `
Log Analysis Summary:
- Analyzed ${totalEntries} log entries
- Found ${errorCount} errors (${errorRate}% error rate)
- Detected ${warningCount} warnings

${errorCount > 0 ? 'There are errors in the logs that require attention.' : 'No major errors detected in the logs.'}
  `.trim();
}