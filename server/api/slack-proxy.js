import fetch from 'node-fetch';

/**
 * Proxy function to send Slack notifications from the server
 * This avoids CORS issues when sending from the browser
 */
export const sendSlackNotification = async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body;
    
    // Validate required parameters
    if (!webhookUrl || !payload) {
      return res.status(400).json({
        success: false,
        error: 'Missing webhookUrl or payload parameters'
      });
    }
    
    // Log the request (but not the webhook URL for security)
    console.log('Proxying Slack notification:', {
      to: 'Slack webhook',
      contentType: typeof payload,
      size: JSON.stringify(payload).length
    });
    
    // Forward the request to Slack
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    // Check for success response from Slack
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Slack responded with status ${response.status}: ${text}`);
    }
    
    console.log('Slack notification sent successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error sending Slack notification'
    });
  }
}; 