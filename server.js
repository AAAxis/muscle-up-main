// Express server for API routes (mimics Next.js API routes pattern)
// This allows local development without Vercel functions
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Import API route handlers
import { POST as sendNotificationPOST } from './app/api/send-notification/route.js';

// API Routes (matching Next.js app/api structure)
app.post('/api/send-notification', async (req, res) => {
  // Convert Express req/res to Next.js-like format
  const request = {
    json: async () => req.body,
    body: req.body
  };
  
  try {
    const nextResponse = await sendNotificationPOST(request);
    
    // Handle NextResponse
    if (nextResponse && nextResponse.body) {
      res.status(nextResponse.status || 200);
      
      // Set headers
      if (nextResponse.headers) {
        Object.entries(nextResponse.headers).forEach(([key, value]) => {
          res.setHeader(key, value);
        });
      }
      
      // Parse and send JSON response
      try {
        const jsonData = JSON.parse(nextResponse.body);
        res.json(jsonData);
      } catch (parseError) {
        res.send(nextResponse.body);
      }
    } else {
      res.status(500).json({ error: 'Invalid response format' });
    }
  } catch (error) {
    console.error('❌ Error in send-notification handler:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📡 API routes available at http://localhost:${PORT}/api/*`);
});
