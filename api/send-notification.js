// Vercel serverless function to send FCM notifications to specific users
// Uses FCM REST API directly (no Admin SDK required)
// Requires FCM_SERVER_KEY environment variable in Vercel

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
    // Check for FCM Server Key
    const fcmServerKey = process.env.FCM_SERVER_KEY;
    if (!fcmServerKey) {
      res.status(500).json({
        error: 'FCM Server Key not configured',
        message: 'FCM_SERVER_KEY environment variable is required. Get it from Firebase Console → Project Settings → Cloud Messaging → Server Key',
      });
      return;
    }

    const { fcmToken, tokens, title, body, data, imageUrl } = req.body;

    // Validate required fields
    if (!title || !body) {
      res.status(400).json({ 
        error: 'Missing required fields',
        details: 'title and body are required'
      });
      return;
    }

    // Support both single token and multiple tokens (like esim-main)
    const fcmTokens = tokens && Array.isArray(tokens) ? tokens : (fcmToken ? [fcmToken] : []);
    
    if (fcmTokens.length === 0) {
      res.status(400).json({ 
        error: 'Missing FCM token(s)',
        details: 'Either fcmToken (single) or tokens (array) is required. Get it from Firestore fcm_tokens collection or user document.'
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

    // Send notification using FCM REST API
    const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${fcmServerKey}`,
      },
      body: JSON.stringify(fcmMessage),
    });

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

    // Check FCM response
    const successCount = fcmResult.success || (fcmResult.results ? fcmResult.results.filter(r => r.message_id).length : 0);
    const failureCount = fcmResult.failure || (fcmResult.results ? fcmResult.results.filter(r => r.error).length : 0);

    if (failureCount > 0 && successCount === 0) {
      console.error('❌ FCM send failed:', fcmResult.results);
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
      messageId: fcmResult.multicast_id || fcmResult.message_id,
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
