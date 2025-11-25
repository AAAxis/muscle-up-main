// Vercel serverless function to send FCM notifications to specific users
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // Initialize with service account credentials from environment variable
    // For Vercel, you should set FIREBASE_SERVICE_ACCOUNT as an environment variable
    // containing the JSON service account key
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : null;

    if (!serviceAccount) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT environment variable is not set');
      // Fallback: try to use default credentials (for local development)
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    console.log('✅ Firebase Admin SDK initialized');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error);
  }
}

const db = admin.firestore();

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
    const { userId, userEmail, title, body, data, imageUrl } = req.body;

    // Validate required fields
    if (!title || !body) {
      res.status(400).json({ 
        error: 'Missing required fields',
        details: 'title and body are required'
      });
      return;
    }

    // Either userId or userEmail must be provided
    if (!userId && !userEmail) {
      res.status(400).json({ 
        error: 'Missing user identifier',
        details: 'Either userId or userEmail must be provided'
      });
      return;
    }

    console.log(`📤 Sending notification to user: ${userId || userEmail}`);
    console.log(`📝 Title: ${title}`);
    console.log(`📝 Body: ${body}`);

    // Get FCM tokens for the user
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
        res.status(404).json({ 
          error: 'User not found',
          details: `No user found with email: ${userEmail}`
        });
        return;
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
      res.status(404).json({ 
        error: 'No FCM tokens found',
        details: `No active FCM tokens found for user: ${userId || userEmail}`
      });
      return;
    }

    console.log(`📱 Found ${fcmTokens.length} FCM token(s) for user`);

    // Prepare notification payload
    const message = {
      notification: {
        title: title,
        body: body,
        ...(imageUrl && { imageUrl: imageUrl }),
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

    // Send notifications to all tokens
    const results = await Promise.allSettled(
      fcmTokens.map(token => 
        admin.messaging().send({
          ...message,
          token: token,
        })
      )
    );

    // Count successes and failures
    const successes = results.filter(r => r.status === 'fulfilled').length;
    const failures = results.filter(r => r.status === 'rejected').length;

    // Log failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`❌ Failed to send to token ${index + 1}:`, result.reason);
        
        // If token is invalid, mark it as inactive
        if (result.reason?.code === 'messaging/invalid-registration-token' ||
            result.reason?.code === 'messaging/registration-token-not-registered') {
          // Mark token as inactive in Firestore
          db.collection('fcm_tokens')
            .where('token', '==', fcmTokens[index])
            .get()
            .then(snapshot => {
              snapshot.docs.forEach(doc => {
                doc.ref.update({ active: false });
              });
            });
        }
      }
    });

    if (successes === 0) {
      res.status(500).json({ 
        error: 'Failed to send notifications',
        details: 'All notification attempts failed',
        failures: failures,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: `Notification sent successfully`,
      sent: successes,
      failed: failures,
      totalTokens: fcmTokens.length,
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

