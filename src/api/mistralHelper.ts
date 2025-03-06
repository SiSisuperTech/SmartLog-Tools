import type { LogEntry, LogAnalysis } from '../types';
const MISTRAL_API_KEY = process.env.VITE_MISTRAL_API_KEY;
const API_URL = 'https://api.mistral.ai/v1/chat/completions';

// Helper function to calculate error rate
function calculateErrorRate(logs: LogEntry[]): number {
  if (logs.length === 0) return 0;
  
  const errorCount = logs.filter(log => 
    log.severity === 'error' || 
    log.message.toLowerCase().includes('error')
  ).length;
  
  return (errorCount / logs.length) * 100;
}

function detectPatterns(logs: LogEntry[]): Array<{ pattern: string; count: number }> {
  const patterns: Array<{ pattern: string; count: number }> = [];
  const messageCounts: Record<string, number> = {};
  
  // Count occurrences of each message pattern
  logs.forEach(log => {
    // Simplify the message to detect patterns (remove timestamps, IDs, etc.)
    let pattern = log.message
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[TIMESTAMP]')
      .replace(/\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/gi, '[UUID]')
      .replace(/\b\d+\.\d+\.\d+\.\d+\b/g, '[IP]')
      .replace(/\b\d{5,}\b/g, '[NUMBER]');
    
    messageCounts[pattern] = (messageCounts[pattern] || 0) + 1;
  });
  
  // Convert to array and sort by count
  Object.entries(messageCounts)
    .filter(([_, count]) => count > 1) // Only include patterns that appear more than once
    .sort(([_, countA], [__, countB]) => countB - countA)
    .slice(0, 10) // Take top 10 patterns
    .forEach(([pattern, count]) => {
      patterns.push({ pattern, count });
    });
  
  return patterns;
}

function getTimeDistribution(logs: LogEntry[]): Array<{ hour: number; count: number }> {
  const hourCounts: Record<number, number> = {};
  
  // Count logs by hour
  logs.forEach(log => {
    try {
      const date = new Date(log.timestamp);
      const hour = date.getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    } catch (e) {
      // Skip invalid timestamps
    }
  });
  
  // Convert to array and sort by hour
  const distribution = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => a.hour - b.hour);
  
  return distribution;
}

// Get severity counts for the analysis
function getSeverityCounts(logs: LogEntry[]) {
  return {
    info: logs.filter(log => log.severity === 'info' || (!log.message.toLowerCase().includes('error') && !log.message.toLowerCase().includes('warn'))).length,
    warning: logs.filter(log => log.severity === 'warning' || (log.message.toLowerCase().includes('warn') && !log.message.toLowerCase().includes('error'))).length,
    error: logs.filter(log => log.severity === 'error' || log.message.toLowerCase().includes('error')).length
  };
}

export async function analyzeLogs(logs: LogEntry[]): Promise<LogAnalysis> {
  // Extract system prompt for better analysis
  const systemPrompt = `
You are an expert log analysis AI. Analyze the following logs and provide insights:
1. Identify error patterns and their possible causes
2. Highlight any suspicious activities or security concerns
3. Suggest potential performance bottlenecks
4. Provide a brief summary of what seems to be happening
5. Recommend actions to resolve any issues found

Format your response in markdown with clear sections.
`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'mistral-small',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(logs.slice(0, 50)) } // Limit to 50 logs to avoid token limits
        ]
      })
    });

    const data = await response.json();
    const severityCounts = getSeverityCounts(logs);

    // If the API call fails, create a fallback analysis
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return {
        mistralAnalysis: "AI analysis failed. Please try again later.",
        errorRate: calculateErrorRate(logs),
        commonPatterns: [], // This is a placeholder, we'll use 'patterns' below
        timeDistribution: getTimeDistribution(logs),
        severity: severityCounts,
        patterns: detectPatterns(logs) // This matches what the LogAnalysis type expects
      } as LogAnalysis;
    }

    // Return the analysis results
    return {
      mistralAnalysis: data.choices[0].message.content,
      errorRate: calculateErrorRate(logs),
      commonPatterns: [], // This is a placeholder, we'll use 'patterns' below
      timeDistribution: getTimeDistribution(logs),
      severity: severityCounts,
      patterns: detectPatterns(logs) // This matches what the LogAnalysis type expects
    } as LogAnalysis;
  } catch (error) {
    console.error('Error in Mistral API:', error);
    const severityCounts = getSeverityCounts(logs);
    
    // Return fallback analysis
    return {
      mistralAnalysis: "AI analysis unavailable. Using statistical analysis only.",
      errorRate: calculateErrorRate(logs),
      commonPatterns: [], // This is a placeholder, we'll use 'patterns' below
      timeDistribution: getTimeDistribution(logs),
      severity: severityCounts,
      patterns: detectPatterns(logs) // This matches what the LogAnalysis type expects
    } as LogAnalysis;
  }
}