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

  try {
    const backendUrl = process.env.DALLE_SERVICE_URL || 'https://dalle.roamjet.net';
    const targetUrl = `${backendUrl}/chat`;

    // Vercel automatically parses JSON body when Content-Type is application/json
    const requestBody = req.body;

    if (!requestBody) {
      res.status(400).json({ error: 'Request body is required' });
      return;
    }

    console.log('Proxying request to:', targetUrl);
    console.log('Request body:', JSON.stringify(requestBody).substring(0, 200));

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

