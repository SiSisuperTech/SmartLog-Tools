#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get the directory of the current script
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('Starting the application...');

// Function to create a colored console output
const colors = {
  server: '\x1b[36m', // Cyan
  frontend: '\x1b[35m', // Magenta
  error: '\x1b[31m', // Red
  info: '\x1b[32m', // Green
  reset: '\x1b[0m' // Reset
};

function logWithPrefix(prefix, data, color) {
  const lines = data.toString().trim().split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      console.log(`${color}[${prefix}]${colors.reset} ${line}`);
    }
  });
}

// Make sure previous server is killed
try {
  if (fs.existsSync(path.join(__dirname, '.server-info.json'))) {
    const serverInfo = JSON.parse(
      fs.readFileSync(path.join(__dirname, '.server-info.json'), 'utf8')
    );
    
    if (serverInfo.pid) {
      try {
        // On Windows, we can't directly kill using Node.js
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', serverInfo.pid, '/f'], { stdio: 'ignore' });
        } else {
          process.kill(serverInfo.pid, 'SIGTERM');
        }
        console.log(`${colors.info}[INFO]${colors.reset} Killed existing server process (PID: ${serverInfo.pid})`);
      } catch (killError) {
        // Ignore errors if process is already gone
      }
    }
  }
} catch (error) {
  console.error(`${colors.error}[ERROR]${colors.reset} Error handling existing server:`, error);
}

// Start the backend server
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'pipe',
  shell: true
});

server.stdout.on('data', (data) => {
  logWithPrefix('SERVER', data, colors.server);
});

server.stderr.on('data', (data) => {
  logWithPrefix('SERVER ERROR', data, colors.error);
});

// Wait a moment for the server to initialize before starting the frontend
setTimeout(() => {
  // Start the frontend development server
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'pipe',
    shell: true
  });

  frontend.stdout.on('data', (data) => {
    logWithPrefix('FRONTEND', data, colors.frontend);
  });

  frontend.stderr.on('data', (data) => {
    logWithPrefix('FRONTEND ERROR', data, colors.error);
  });

  // Handle signals for graceful shutdown
  const cleanup = () => {
    console.log(`\n${colors.info}[INFO]${colors.reset} Shutting down...`);
    
    // Kill both processes
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', server.pid, '/f'], { stdio: 'ignore' });
      spawn('taskkill', ['/pid', frontend.pid, '/f'], { stdio: 'ignore' });
    } else {
      server.kill('SIGTERM');
      frontend.kill('SIGTERM');
    }
    
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  frontend.on('close', (code) => {
    console.log(`${colors.info}[INFO]${colors.reset} Frontend process exited with code ${code}`);
    cleanup();
  });
}, 3000);

server.on('close', (code) => {
  console.log(`${colors.info}[INFO]${colors.reset} Server process exited with code ${code}`);
  process.exit(code);
});

console.log(`${colors.info}[INFO]${colors.reset} Starting servers... Please wait a moment.`); 