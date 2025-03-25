import express from 'express';
import cors from 'cors';
import slackProxy from './api/proxy/slack';

const app = express();

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Register the Slack proxy route
app.use('/api/proxy', slackProxy);

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 