const { execSync } = require('child_process');
const path = require('path');

console.log('Restarting server...');

try {
  // Kill any existing server processes on common ports
  console.log('Killing existing server processes...');
  try {
    execSync('npx kill-port 3005 3007');
    console.log('Killed processes on ports 3005 and 3007');
  } catch (error) {
    console.log('No processes found on ports 3005 and 3007');
  }

  // Start a new server instance
  console.log('Starting new server instance...');
  const serverPath = path.join(__dirname, 'server.js');
  
  // Use spawn to keep the server running after this script exits
  const { spawn } = require('child_process');
  const server = spawn('node', [serverPath], {
    detached: true,
    stdio: 'inherit'
  });
  
  // Unref the child process so this script can exit independently
  server.unref();
  
  console.log('Server started successfully');
} catch (error) {
  console.error('Error restarting server:', error.message);
} 