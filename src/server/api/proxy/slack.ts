import express, { Request, Response } from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.post('/slack', async (req: Request, res: Response) => {
  try {
    const { webhookUrl, payload } = req.body;

    if (!webhookUrl || !payload) {
      return res.status(400).json({ error: 'Missing webhookUrl or payload' });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack API responded with status: ${response.status}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error proxying Slack notification:', error);
    res.status(500).json({ error: 'Failed to send Slack notification' });
  }
});

export default router; 