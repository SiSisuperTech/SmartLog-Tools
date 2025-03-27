import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Function to get the server port from the server info file
function getServerPort() {
  try {
    const serverInfoPath = path.resolve('.server-info.json');
    if (fs.existsSync(serverInfoPath)) {
      const serverInfo = JSON.parse(fs.readFileSync(serverInfoPath, 'utf8'));
      if (serverInfo.port) {
        console.log(`Using detected server port: ${serverInfo.port}`);
        return serverInfo.port;
      }
    }
  } catch (error) {
    console.error('Error reading server port:', error);
  }
  
  // Default fallback port
  console.log('Using default server port: 3005');
  return 3005;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: `http://localhost:${getServerPort()}`,
        changeOrigin: true,
        secure: false
      }
    }
  }
})