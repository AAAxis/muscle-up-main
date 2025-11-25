// Vercel serverless function to send FCM notifications to specific users
// Supports both FCM_SERVER_KEY (simple) and FIREBASE_SERVICE_ACCOUNT (more powerful)
// Option 1: Set FCM_SERVER_KEY environment variable (simpler)
// Option 2: Set FIREBASE_SERVICE_ACCOUNT environment variable with service account JSON (more powerful)

let admin = null;
let db = null;

// Try to initialize Firebase Admin SDK if service account is provided
try {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      db = admin.firestore();
      console.log('✅ Firebase Admin SDK initialized with service account');
    } else {
      db = admin.firestore();
    }
  }
} catch (error) {
  console.warn('⚠️ Could not initialize Firebase Admin SDK:', error.message);
  console.log('💡 Will use FCM REST API with FCM_SERVER_KEY instead');
}

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
    const { fcmToken, tokens, userId, userEmail, title, body, data, imageUrl } = req.body;

    // Validate required fields
    if (!title || !body) {
      res.status(400).json({ 
        error: 'Missing required fields',
        details: 'title and body are required'
      });
      return;
    }

    // Get FCM tokens - support multiple methods
    let fcmTokens = [];
    
    // Method 1: Tokens provided directly
    if (tokens && Array.isArray(tokens) && tokens.length > 0) {
      fcmTokens = tokens;
    } else if (fcmToken) {
      fcmTokens = [fcmToken];
    }
    // Method 2: Get tokens from Firestore using Admin SDK (if available)
    else if (db && (userId || userEmail)) {
      try {
        if (userId) {
          const tokensSnapshot = await db.collection('fcm_tokens')
            .where('userId', '==', userId)
            .where('active', '==', true)
            .limit(10)
            .get();
          fcmTokens = tokensSnapshot.docs.map(doc => doc.data().token);
        } else if (userEmail) {
          // Get user by email first
          const usersSnapshot = await db.collection('users')
            .where('email', '==', userEmail)
            .limit(1)
            .get();
          
          if (!usersSnapshot.empty) {
            const userIdFromEmail = usersSnapshot.docs[0].id;
            const tokensSnapshot = await db.collection('fcm_tokens')
              .where('userId', '==', userIdFromEmail)
              .where('active', '==', true)
              .limit(10)
              .get();
            fcmTokens = tokensSnapshot.docs.map(doc => doc.data().token);
          }
        }
      } catch (firestoreError) {
        console.error('Error getting tokens from Firestore:', firestoreError);
      }
    }
    
    if (fcmTokens.length === 0) {
      res.status(400).json({ 
        error: 'Missing FCM token(s)',
        details: 'Provide either: tokens (array), fcmToken (single), or userId/userEmail (requires FIREBASE_SERVICE_ACCOUNT)'
      });
      return;
    }

    console.log(`📤 Sending notification to ${fcmTokens.length} token(s)`);
    console.log(`📝 Title: ${title}`);
    console.log(`📝 Body: ${body}`);

    // Send to multiple tokens using FCM batch API
    // For single token, use 'to', for multiple use 'registration_ids'
    const fcmMessage = fcmTokens.length === 1 ? {
      to: fcmTokens[0],
      notification: {
        title: title,
        body: body,
        ...(imageUrl && { image: imageUrl }),
      },
      data: {
        ...(data || {}),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'muscleup_notifications',
          sound: 'default',
          priority: 'high',
          ...(imageUrl && { image: imageUrl }),
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
    } : {
      registration_ids: fcmTokens,
      notification: {
        title: title,
        body: body,
        ...(imageUrl && { image: imageUrl }),
      },
      data: {
        ...(data || {}),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'muscleup_notifications',
          sound: 'default',
          priority: 'high',
          ...(imageUrl && { image: imageUrl }),
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

    // Send notification - use Admin SDK if available, otherwise use REST API
    let fcmResult;
    let successCount = 0;
    let failureCount = 0;
    
    if (admin && admin.messaging) {
      // Use Firebase Admin SDK (more reliable)
      try {
        const results = await Promise.allSettled(
          fcmTokens.map(token =>
            admin.messaging().send({
              ...fcmMessage,
              token: token,
            })
          )
        );
        
        successCount = results.filter(r => r.status === 'fulfilled').length;
        failureCount = results.filter(r => r.status === 'rejected').length;
        
        fcmResult = {
          success: successCount,
          failure: failureCount,
          results: results.map((r, i) => ({
            token: fcmTokens[i].substring(0, 20) + '...',
            success: r.status === 'fulfilled',
            error: r.status === 'rejected' ? r.reason?.message : null,
          })),
        };
      } catch (adminError) {
        console.error('Admin SDK send error:', adminError);
        throw adminError;
      }
    } else {
      // Use FCM REST API (fallback)
      const fcmServerKey = process.env.FCM_SERVER_KEY;
      if (!fcmServerKey) {
        res.status(500).json({
          error: 'FCM credentials not configured',
          message: 'Either FCM_SERVER_KEY or FIREBASE_SERVICE_ACCOUNT environment variable is required',
        });
        return;
      }
      
      const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `key=${fcmServerKey}`,
        },
        body: JSON.stringify(fcmMessage),
      });
      
      fcmResult = await fcmResponse.json();
      
      if (!fcmResponse.ok) {
        console.error('❌ FCM API error:', fcmResult);
        res.status(fcmResponse.status).json({
          success: false,
          error: 'FCM API error',
          message: fcmResult.error || 'Failed to send notification',
          details: fcmResult,
        });
        return;
      }
      
      successCount = fcmResult.success || (fcmResult.results ? fcmResult.results.filter(r => r.message_id).length : 0);
      failureCount = fcmResult.failure || (fcmResult.results ? fcmResult.results.filter(r => r.error).length : 0);
    }

    const fcmResult = await fcmResponse.json();

    if (!fcmResponse.ok) {
      console.error('❌ FCM API error:', fcmResult);
      res.status(fcmResponse.status).json({
        success: false,
        error: 'FCM API error',
        message: fcmResult.error || 'Failed to send notification',
        details: fcmResult,
      });
      return;
    }

    if (failureCount > 0 && successCount === 0) {
      console.error('❌ FCM send failed:', fcmResult);
      res.status(400).json({
        success: false,
        error: 'Failed to send notification',
        message: fcmResult.results?.[0]?.error || 'Unknown error',
        details: fcmResult,
      });
      return;
    }

    console.log(`✅ Notification sent successfully: ${successCount} success, ${failureCount} failures`);
    res.status(200).json({
      success: true,
      message: 'Notification sent successfully',
      successCount: successCount,
      failureCount: failureCount,
      totalTokens: fcmTokens.length,
      fcmResult: fcmResult,
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
