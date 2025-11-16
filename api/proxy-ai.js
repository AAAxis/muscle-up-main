// Vercel serverless function to proxy AI chat requests with CORS support
export default async function handler(req, res) {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Helper function to get raw body from request stream
  function getRawBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }

  try {
    const backendUrl = process.env.DALLE_SERVICE_URL || 'https://dalle.roamjet.net';
    const targetUrl = `${backendUrl}/chat`;

    // Handle request body - Vercel may or may not auto-parse
    let requestBody = req.body;
    
    // Debug logging
    console.log('Request method:', req.method);
    console.log('Request body type:', typeof requestBody);
    console.log('Request body exists:', !!requestBody);
    
    // If body is undefined, try to get it from raw body
    if (requestBody === undefined) {
      try {
        // Try reading raw body from request stream
        const rawBody = await getRawBody(req);
        requestBody = rawBody ? JSON.parse(rawBody) : null;
      } catch (readError) {
        console.error('Failed to read raw body:', readError);
        res.status(400).json({ 
          error: 'Could not parse request body',
          details: readError.message 
        });
        return;
      }
    }
    
    // If body is a string, parse it
    if (typeof requestBody === 'string') {
      try {
        requestBody = JSON.parse(requestBody);
      } catch (e) {
        res.status(400).json({ error: 'Invalid JSON in request body' });
        return;
      }
    }

    if (!requestBody) {
      res.status(400).json({ error: 'Request body is required' });
      return;
    }

    console.log('Proxying to:', targetUrl);
    console.log('Request body keys:', Object.keys(requestBody));

    // Forward the request to the backend service
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (parseError) {
        errorData = { error: await response.text() || 'Backend service error' };
      }
      
      console.error('Backend service error:', response.status, errorData);
      res.status(response.status).json({
        error: errorData.error || errorData.details || 'Backend service error',
        status: response.status,
      });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

