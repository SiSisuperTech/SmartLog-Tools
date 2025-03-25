// api/analyze-logs.js
import { analyzeLogs } from '../mistralHelper.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { logs } = req.body;
    
    // Ensure logs is an array and not empty
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      console.error('Invalid logs data:', logs);
      return res.status(400).json({ error: 'Invalid or empty logs data' });
    }

    // Validate log entries
    const validLogs = logs.filter(log => 
      log && 
      typeof log.message === 'string' && 
      log.message.trim() !== ''
    );

    if (validLogs.length === 0) {
      console.error('No valid log entries found');
      return res.status(400).json({ error: 'No valid log entries found' });
    }

    const result = await analyzeLogs(validLogs);
    
    res.json(result);
  } catch (error) {
    console.error('Log analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze logs',
      details: error.message 
    });
  }
}