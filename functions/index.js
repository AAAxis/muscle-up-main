// Firebase Cloud Functions
// This is the main entry point for all Firebase Functions

const {onCall, onRequest, HttpsError} = require('firebase-functions/v2/https');
const {setGlobalOptions} = require('firebase-functions/v2');
const {defineSecret} = require('firebase-functions/params');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// In Firebase Functions, admin is automatically initialized
// But we can explicitly initialize if needed
if (!admin.apps.length) {
  admin.initializeApp();
}

// Set global options for 2nd gen functions
setGlobalOptions({
  region: 'us-central1',
});

// Define secrets
const openaiApiKey = defineSecret('OPENAI_API_KEY');

// Helper function to check if token is an Expo Push Token
function isExpoPushToken(token) {
  return token && typeof token === 'string' && token.startsWith('ExponentPushToken[');
}

// Helper function to send Expo Push Notification
async function sendExpoPushNotification(token, title, body, data = {}) {
  const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';
  
  const message = {
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: data,
    priority: 'high',
    channelId: 'vitrix_notifications',
  };

  try {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Expo API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    console.log('📱 Expo Push API response:', JSON.stringify(result, null, 2));
    
    // Check if there are any errors in the response
    if (result.data && result.data.status === 'error') {
      const errorMsg = result.data.message || 'Expo push notification failed';
      console.error('❌ Expo Push API error:', errorMsg);
      throw new Error(errorMsg);
    }

    // Check for errors array in response
    if (result.errors && result.errors.length > 0) {
      const errorMsg = result.errors.map(e => e.message || e).join(', ');
      console.error('❌ Expo Push API errors:', errorMsg);
      throw new Error(errorMsg);
    }

    return { success: true, receiptId: result.data?.id };
  } catch (error) {
    console.error('Error sending Expo push notification:', error);
    throw error;
  }
}

// Export the sendFCMNotification function
exports.sendFCMNotification = onCall(async (request) => {
  const {data, auth} = request;
  const context = {auth};
  // Verify user is authenticated
  if (!context.auth) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated to send notifications'
    );
  }

  const { userId, userEmail, title, body, data: notificationData, imageUrl } = data;

  // Validate required fields
  if (!title || !body) {
    throw new HttpsError(
      'invalid-argument',
      'Title and body are required'
    );
  }

  if (!userId && !userEmail) {
    throw new HttpsError(
      'invalid-argument',
      'Either userId or userEmail must be provided'
    );
  }

  try {
    const db = admin.firestore();
    let fcmTokens = [];

    if (userId) {
      // Query by userId
      const tokensSnapshot = await db.collection('fcm_tokens')
        .where('userId', '==', userId)
        .where('active', '==', true)
        .get();

      fcmTokens = tokensSnapshot.docs.map(doc => doc.data().token);
    } else if (userEmail) {
      // First, get userId from users collection
      const usersSnapshot = await db.collection('users')
        .where('email', '==', userEmail)
        .limit(1)
        .get();

      if (usersSnapshot.empty) {
        throw new HttpsError(
          'not-found',
          `No user found with email: ${userEmail}`
        );
      }

      const userIdFromEmail = usersSnapshot.docs[0].id;

      // Query by userId
      const tokensSnapshot = await db.collection('fcm_tokens')
        .where('userId', '==', userIdFromEmail)
        .where('active', '==', true)
        .get();

      fcmTokens = tokensSnapshot.docs.map(doc => doc.data().token);
    }

    if (fcmTokens.length === 0) {
      throw new HttpsError(
        'not-found',
        `No active FCM tokens found for user: ${userId || userEmail}`
      );
    }

    // Separate tokens into FCM and Expo Push Tokens
    const fcmTokensList = [];
    const expoTokensList = [];

    fcmTokens.forEach(token => {
      if (isExpoPushToken(token)) {
        expoTokensList.push(token);
      } else {
        fcmTokensList.push(token);
      }
    });

    console.log(`📱 Found ${fcmTokensList.length} FCM tokens and ${expoTokensList.length} Expo tokens`);

    // Prepare FCM notification payload (for Flutter)
    const fcmMessage = {
      notification: {
        title: title,
        body: body,
        ...(imageUrl && { imageUrl: imageUrl }),
      },
      data: {
        ...(notificationData || {}),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'vitrix_notifications',
          sound: 'default',
          priority: 'high',
          ...(imageUrl && { imageUrl: imageUrl }),
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            alert: {
              title: title,
              body: body,
            },
          },
        },
      },
    };

    // Prepare notification data for Expo (React Native)
    const expoNotificationData = {
      ...(notificationData || {}),
      source: 'fcm',
      sentFrom: 'web',
    };

    // Send FCM notifications (Flutter)
    const fcmResults = await Promise.allSettled(
      fcmTokensList.map(token =>
        admin.messaging().send({
          ...fcmMessage,
          token: token,
        })
      )
    );

    // Send Expo Push notifications (React Native)
    console.log(`📱 Sending ${expoTokensList.length} Expo push notifications...`);
    const expoResults = await Promise.allSettled(
      expoTokensList.map(async (token, index) => {
        console.log(`📱 [${index + 1}/${expoTokensList.length}] Sending to token: ${token.substring(0, 30)}...`);
        try {
          const result = await sendExpoPushNotification(token, title, body, expoNotificationData);
          console.log(`✅ [${index + 1}/${expoTokensList.length}] Success:`, result);
          return result;
        } catch (error) {
          console.error(`❌ [${index + 1}/${expoTokensList.length}] Failed:`, error.message);
          throw error;
        }
      })
    );

    // Combine results
    const allResults = [...fcmResults, ...expoResults];
    const allTokens = [...fcmTokensList, ...expoTokensList];

    // Count successes and failures
    const successes = allResults.filter(r => r.status === 'fulfilled').length;
    const failures = allResults.filter(r => r.status === 'rejected').length;

    // Log failures and mark invalid tokens as inactive
    allResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to send to token ${index + 1}:`, result.reason);

        const token = allTokens[index];
        const isExpo = isExpoPushToken(token);

        // Mark invalid tokens as inactive
        if (isExpo) {
          // For Expo tokens, mark as inactive if error indicates invalid token
          if (result.reason?.message?.includes('InvalidExpoPushToken') || 
              result.reason?.message?.includes('DeviceNotRegistered')) {
            db.collection('fcm_tokens')
              .where('token', '==', token)
              .get()
              .then(snapshot => {
                snapshot.docs.forEach(doc => {
                  doc.ref.update({ active: false });
                });
              });
          }
        } else {
          // For FCM tokens, check Firebase error codes
          if (
            result.reason?.code === 'messaging/invalid-registration-token' ||
            result.reason?.code === 'messaging/registration-token-not-registered'
          ) {
            db.collection('fcm_tokens')
              .where('token', '==', token)
              .get()
              .then(snapshot => {
                snapshot.docs.forEach(doc => {
                  doc.ref.update({ active: false });
                });
              });
          }
        }
      }
    });

    if (successes === 0) {
      throw new HttpsError(
        'internal',
        'All notification attempts failed'
      );
    }

    return {
      success: true,
      message: 'Notification sent successfully',
      sent: successes,
      failed: failures,
      totalTokens: allTokens.length,
      fcmTokens: fcmTokensList.length,
      expoTokens: expoTokensList.length,
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      'internal',
      `Error sending notification: ${error.message}`
    );
  }
});

// DALL-E Image Generation Function
exports.generateImage = onCall({
  timeoutSeconds: 120,
  memory: '512MiB',
  secrets: [openaiApiKey],
}, async (request) => {
  const {data} = request;
  
  try {
    if (!data) {
      throw new HttpsError('invalid-argument', 'No data provided');
    }
    
    const prompt = data.prompt;
    if (!prompt) {
      throw new HttpsError('invalid-argument', 'Prompt is required');
    }
    
    // Get OpenAI API key from secret
    const OPENAI_API_KEY = openaiApiKey.value();
    if (!OPENAI_API_KEY) {
      throw new HttpsError('failed-precondition', 'OpenAI API key not configured');
    }
    
    const IMAGE_MODEL = process.env.IMAGE_MODEL || 'dall-e-3';
    const size = data.size || '1024x1024';
    
    const payload = {
      model: IMAGE_MODEL,
      prompt: prompt,
      size: size,
      response_format: 'url',
    };
    
    // DALL-E 3 only supports n=1 and specific sizes
    if (IMAGE_MODEL === 'dall-e-3') {
      if (!['1024x1024', '1792x1024', '1024x1792'].includes(size)) {
        payload.size = '1024x1024';
      }
    } else {
      // DALL-E 2 supports n parameter
      payload.n = 1;
    }
    
    const apiUrl = 'https://api.openai.com/v1/images/generations';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error?.message || errorData.error || errorMsg;
      } catch (e) {
        // Ignore JSON parse errors
      }
      throw new HttpsError(
        'internal',
        `API error: ${response.status} - ${errorMsg}`
      );
    }
    
    const result = await response.json();
    
    // Extract image URL from response
    if (result.data && result.data.length > 0) {
      const imageData = result.data[0];
      return {
        url: imageData.url || imageData.b64_json,
        revised_prompt: imageData.revised_prompt,
      };
    } else {
      throw new HttpsError('internal', 'No image data in response');
    }
  } catch (error) {
    console.error('Error generating image:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      throw new HttpsError('deadline-exceeded', 'Request timeout - image generation took too long');
    }
    throw new HttpsError('internal', `Error generating image: ${error.message}`);
  }
});

// Chat Completion Function
exports.chatCompletion = onCall({
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: [openaiApiKey],
}, async (request) => {
  const {data} = request;
  
  try {
    if (!data) {
      throw new HttpsError('invalid-argument', 'No data provided');
    }
    
    // Handle both message format and simple prompt format
    let messages = data.messages;
    if (!messages) {
      const prompt = data.prompt;
      if (!prompt) {
        throw new HttpsError('invalid-argument', 'Either messages or prompt is required');
      }
      messages = [{role: 'user', content: prompt}];
    }
    
    // Get OpenAI API key from secret
    const OPENAI_API_KEY = openaiApiKey.value();
    if (!OPENAI_API_KEY) {
      throw new HttpsError('failed-precondition', 'OpenAI API key not configured');
    }
    
    const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-4o-mini';
    
    const payload = {
      model: data.model || CHAT_MODEL,
      messages: messages,
      temperature: data.temperature || 0.7,
      max_tokens: data.max_tokens || 4000,
      top_p: data.top_p || 1,
      frequency_penalty: data.frequency_penalty || 0,
      presence_penalty: data.presence_penalty || 0,
    };
    
    // Add response format if specified
    if (data.response_format) {
      payload.response_format = data.response_format;
    }
    
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error?.message || errorData.error || errorMsg;
      } catch (e) {
        // Ignore JSON parse errors
      }
      throw new HttpsError(
        'internal',
        `API error: ${response.status} - ${errorMsg}`
      );
    }
    
    const result = await response.json();
    
    // Return the full response (compatible with OpenAI format)
    return result;
  } catch (error) {
    console.error('Error in chat completion:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      throw new HttpsError('deadline-exceeded', 'Request timeout - chat completion took too long');
    }
    throw new HttpsError('internal', `Error in chat completion: ${error.message}`);
  }
});

// Analyze Food Image Function
exports.analyzeFoodImage = onCall({
  timeoutSeconds: 60,
  memory: '512MiB',
  secrets: [openaiApiKey],
}, async (request) => {
  const {data} = request;
  
  try {
    if (!data) {
      throw new HttpsError('invalid-argument', 'No data provided');
    }
    
    const imageUrl = data.imageUrl;
    if (!imageUrl) {
      throw new HttpsError('invalid-argument', 'Image URL is required');
    }
    
    // Get OpenAI API key from secret
    const OPENAI_API_KEY = openaiApiKey.value();
    if (!OPENAI_API_KEY) {
      throw new HttpsError('failed-precondition', 'OpenAI API key not configured');
    }
    
    // Prepare the prompt in Hebrew for food analysis
    const systemPrompt = `אתה מומחה תזונה מוסמך עם ניסיון של 15 שנה בניתוח ארוחות. המשימה שלך היא לבצע ניתוח מקצועי ומדויק של התמונה של האוכל.

חשוב מאוד:
- זהה את סוגי המזון בתמונה
- הערך את הכמויות (גרמים/כוסות/יחידות) ככל האפשר
- חשב קלוריות, חלבונים, פחמימות ושומנים
- תן תיאור מפורט של האוכל בעברית
- ציין יתרונות (pros) וחסרונות (cons) של האוכל בעברית
- היה שמרני בהערכות אם אינך בטוח

השב בפורמט JSON עם השדות הבאים:
- calories: מספר הקלוריות המשוער
- description: תיאור מפורט של האוכל בעברית
- pros: רשימת יתרונות בעברית (מערך של מחרוזות)
- cons: רשימת חסרונות בעברית (מערך של מחרוזות)
- protein: גרמי חלבון (מספר)
- carbs: גרמי פחמימות (מספר)
- fat: גרמי שומן (מספר)
- confidence: רמת ביטחון ('גבוה', 'בינוני', 'נמוך')`;

    const userPrompt = `בצע ניתוח מקצועי של התמונה של האוכל. זהה את המזונות, הערך כמויות, חשב ערכים תזונתיים, ותן תיאור מפורט עם יתרונות וחסרונות בעברית.`;

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userPrompt
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ];

    const payload = {
      model: 'gpt-4o', // Use GPT-4o for vision capabilities
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000,
      response_format: {
        type: 'json_object'
      }
    };

    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      let errorMsg = response.statusText;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error?.message || errorData.error || errorMsg;
      } catch (e) {
        // Ignore JSON parse errors
      }
      throw new HttpsError(
        'internal',
        `API error: ${response.status} - ${errorMsg}`
      );
    }
    
    const result = await response.json();
    
    // Extract the content from the response
    if (!result.choices || result.choices.length === 0) {
      throw new HttpsError('internal', 'No response from AI');
    }
    
    const content = result.choices[0].message.content;
    
    // Parse the JSON response
    let analysisData;
    try {
      analysisData = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from the response if it's wrapped
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new HttpsError('internal', 'Failed to parse AI response as JSON');
      }
    }
    
    // Ensure all required fields are present with defaults
    return {
      calories: analysisData.calories || 0,
      description: analysisData.description || 'לא ניתן לזהות את האוכל בתמונה',
      pros: analysisData.pros || [],
      cons: analysisData.cons || [],
      protein: analysisData.protein || 0,
      carbs: analysisData.carbs || 0,
      fat: analysisData.fat || 0,
      confidence: analysisData.confidence || 'נמוך'
    };
  } catch (error) {
    console.error('Error analyzing food image:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      throw new HttpsError('deadline-exceeded', 'Request timeout - image analysis took too long');
    }
    throw new HttpsError('internal', `Error analyzing food image: ${error.message}`);
  }
});

// Health check endpoint
exports.health = onRequest(async (req, res) => {
  res.json({
    status: 'ok',
    service: 'dalle',
    version: '2.0.0',
  });
});

// Send group email (or single user) via SMTP2Go – same as booster emails, runs on Firebase (no Vercel)
exports.sendGroupEmail = onCall(async (request) => {
  const { data, auth } = request;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to send group emails');
  }
  const { groupName, userEmail: targetUserEmail, title = 'הודעה מהמאמן', message = '' } = data || {};
  if (!groupName && !targetUserEmail) {
    throw new HttpsError('invalid-argument', 'Either group name or user email is required');
  }
  if (!title || !message) {
    throw new HttpsError('invalid-argument', 'Title and message are required');
  }
  const apiKey = process.env.SMTP2GO_API_KEY;
  const senderEmail = process.env.SMTP2GO_SENDER_EMAIL || 'rpochtman@simnetiq.store';
  const senderName = process.env.SMTP2GO_SENDER_NAME || 'Vitrix App';
  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'SMTP2GO_API_KEY is not configured');
  }
  const db = admin.firestore();
  let usersSnapshot;
  if (targetUserEmail) {
    usersSnapshot = await db.collection('users').where('email', '==', targetUserEmail).limit(1).get();
  } else {
    usersSnapshot = await db.collection('users').where('group_names', 'array-contains', groupName).get();
  }
  if (usersSnapshot.empty) {
    return {
      success: true,
      message: `No users found for ${targetUserEmail ? `user: ${targetUserEmail}` : `group: ${groupName}`}`,
      successCount: 0,
      failureCount: 0,
      totalUsers: 0,
      results: [],
    };
  }
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  const sender = `${senderName} <${senderEmail}>`;
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userEmail = userData.email;
    const userName = userData.name || 'מתאמן/ת';
    if (!userEmail) {
      results.push({ userId: userDoc.id, email: null, name: userName, success: false, error: 'No email address' });
      failureCount++;
      continue;
    }
    try {
      const emailText = `שלום ${userName},\n\n${message}`;
      const htmlBody = emailText.replace(/\n/g, '<br>\n');
      const smtpRes = await fetch('https://api.smtp2go.com/v3/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          to: [userEmail],
          sender,
          subject: title,
          html_body: htmlBody,
        }),
      });
      const emailRes = await smtpRes.json();
      if (emailRes.data?.succeeded > 0) {
        results.push({ userId: userDoc.id, email: userEmail, name: userName, success: true, messageId: 'sent' });
        successCount++;
      } else {
        const err = emailRes.data?.failures?.[0] || emailRes.data?.error || 'Failed to send email';
        results.push({ userId: userDoc.id, email: userEmail, name: userName, success: false, error: err });
        failureCount++;
      }
    } catch (error) {
      results.push({ userId: userDoc.id, email: userEmail, name: userName, success: false, error: error.message || 'Unknown error' });
      failureCount++;
    }
  }
  return {
    success: true,
    groupName: groupName || null,
    totalUsers: usersSnapshot.size,
    successCount,
    failureCount,
    results,
  };
});

// Proxy ExerciseDB images/GIFs for web (avoids CORS). No auth required - only allows known ExerciseDB origins.
const EXERCISE_MEDIA_ORIGINS = [
  'https://cdn.exercisedb.dev',
  'https://v2.exercisedb.dev',
  'https://v2.exercisedb.io',
  'https://exercisedb.p.rapidapi.com',
];

exports.exerciseImageProxy = onRequest(async (req, res) => {
  // CORS: allow web app origins
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }

  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') {
    res.status(400).send('Missing url');
    return;
  }
  let targetUrl;
  try {
    targetUrl = decodeURIComponent(rawUrl);
  } catch {
    res.status(400).send('Invalid url');
    return;
  }
  const allowed = EXERCISE_MEDIA_ORIGINS.some(origin => targetUrl.startsWith(origin));
  if (!allowed) {
    res.status(403).send('URL not allowed');
    return;
  }

  const isRapidAPI = targetUrl.startsWith('https://exercisedb.p.rapidapi.com/');
  const apiKey = process.env.EXERCISEDB_RAPIDAPI_KEY || process.env.VITE_EXERCISEDB_RAPIDAPI_KEY || '19a9c82334msh8f9441d42ac9c20p1eb287jsnf6c9f6f8eb4b';
  const fetchOptions = {
    headers: {Accept: 'image/*'},
    redirect: 'follow',
  };
  if (isRapidAPI) {
    fetchOptions.headers['x-rapidapi-host'] = 'exercisedb.p.rapidapi.com';
    fetchOptions.headers['x-rapidapi-key'] = apiKey;
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);
    if (!response.ok) {
      res.status(response.status).send('Upstream error');
      return;
    }
    const contentType = response.headers.get('content-type') || 'image/gif';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    console.error('Exercise image proxy error:', err);
    res.status(502).send('Proxy error');
  }
});
