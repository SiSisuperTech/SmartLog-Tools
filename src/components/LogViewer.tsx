import React, { useState } from 'react';
import type { LogEntry } from '../types';

interface Props {
  logs?: LogEntry[];
  onAnalyze?: () => void;
}

export const LogViewer: React.FC<Props> = ({ logs = [], onAnalyze }) => {
  const [expandedLogIndex, setExpandedLogIndex] = useState<number | null>(null);

  // Helper function to get the proper background color based on severity
  const getLogRowClassName = (log: LogEntry) => {
    const baseClasses = "border-t border-slate-700";
    
    if (log.severity === 'error' || log.message.toLowerCase().includes('error')) {
      return `${baseClasses} bg-red-900/20`;
    } else if (log.severity === 'warning' || log.message.toLowerCase().includes('warn')) {
      return `${baseClasses} bg-yellow-900/20`;
    }
    
    return baseClasses;
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      return timestamp;
    }
  };

  // Helper function to truncate long messages
  const truncateMessage = (message: string, maxLength = 150) => {
    if (message.length <= maxLength) return message;
    return `${message.substring(0, maxLength)}...`;
  };

  // Function to toggle log expansion
  const toggleLogExpansion = (index: number) => {
    if (expandedLogIndex === index) {
      setExpandedLogIndex(null);
    } else {
      setExpandedLogIndex(index);
    }
  };

  // Display a message if no logs are available
  if (logs.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>No logs match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-700">
          <tr>
            <th className="p-2 text-left text-xs uppercase text-slate-300 font-medium">Timestamp</th>
            <th className="p-2 text-left text-xs uppercase text-slate-300 font-medium">Message</th>
            <th className="p-2 text-left text-xs uppercase text-slate-300 font-medium">Stream</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <React.Fragment key={i}>
              <tr 
                className={`${getLogRowClassName(log)} hover:bg-slate-700/30 cursor-pointer transition`}
                onClick={() => toggleLogExpansion(i)}
              >
                <td className="p-2 font-mono text-xs whitespace-nowrap text-slate-300">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="p-2 font-medium">
                  {expandedLogIndex === i ? log.message : truncateMessage(log.message)}
                </td>
                <td className="p-2 text-slate-400 text-sm">
                  {log.logStream}
                </td>
              </tr>
              {expandedLogIndex === i && (
                <tr className="bg-slate-800">
                  <td colSpan={3} className="p-4 border-t border-slate-700">
                    <div className="font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                      {log.message}
                    </div>
                    {/* Check for metadata - type-safe version */}
                    {(log as any).metadata && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <h4 className="text-sm font-medium mb-1 text-slate-300">Metadata:</h4>
                        <pre className="text-xs overflow-x-auto">
                          {JSON.stringify((log as any).metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};