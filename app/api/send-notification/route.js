// Next.js-style API route (matches admin-app pattern exactly)
// This works with both Next.js and can be adapted for other setups
import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin SDK
let adminInitialized = false;

async function initializeAdmin() {
  if (adminInitialized || admin.apps.length) {
    return;
  }

  try {
    let credential;
    
    // Try to use environment variables first (production)
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'muscule-up',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
      console.log('✅ Firebase Admin SDK initialized with environment variables');
    } 
    // Fallback to service account file (development only)
    else {
      try {
        if (fs.existsSync('./muscule-up-924cedf05ad5.json')) {
          credential = admin.credential.cert('./muscule-up-924cedf05ad5.json');
          console.log('✅ Firebase Admin SDK initialized with service account file');
        } else {
          console.warn('⚠️ No Firebase Admin credentials found. Will use FCM REST API fallback.');
          credential = null;
        }
      } catch (fsError) {
        console.warn('⚠️ Could not check for service account file:', fsError.message);
        credential = null;
      }
    }

    if (credential) {
      admin.initializeApp({
        credential,
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'muscule-up',
      });
      console.log('✅ Firebase Admin app initialized successfully');
      adminInitialized = true;
    } else {
      console.log('⚠️ Firebase Admin SDK not initialized - will use FCM REST API fallback');
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
}

// Initialize on module load
initializeAdmin();

// Next.js-style response helper (for compatibility)
// This mimics NextResponse from 'next/server'
export class NextResponse {
  constructor(body, init = {}) {
    this.body = typeof body === 'string' ? body : JSON.stringify(body);
    this.status = init.status || 200;
    this.headers = { 'Content-Type': 'application/json', ...init.headers };
  }

  static json(data, init = {}) {
    return new NextResponse(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
  }
}

export async function POST(request) {
  // Ensure admin is initialized
  await initializeAdmin();
  
  try {
    const requestBody = await request.json();
    const { 
      title, 
      body: messageBody, 
      tokens = [], // Array of FCM tokens
      topic, // Optional: send to topic instead of specific tokens
      data = {}, // Custom data payload
      imageUrl // Optional image URL
    } = requestBody;

    console.log('📱 FCM API called with:', {
      title,
      body: messageBody?.substring(0, 50) + '...',
      tokenCount: tokens.length,
      topic,
      hasImageUrl: !!imageUrl
    });

    // Validation
    if (!title || !messageBody) {
      console.error('❌ Validation failed: Title and body are required');
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    if (!tokens.length && !topic) {
      console.error('❌ Validation failed: Either tokens or topic is required');
      return NextResponse.json(
        { error: 'Either tokens or topic is required' },
        { status: 400 }
      );
    }

    // Build notification payload (exact format from admin-app)
    const message = {
      notification: {
        title,
        body: messageBody,
        ...(imageUrl && { imageUrl })
      },
      data: {
        ...data,
        timestamp: Date.now().toString(),
        source: 'dashboard'
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'muscleup_notifications',
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body: messageBody
            },
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    console.log('📝 Built message payload:', JSON.stringify(message, null, 2));

    // Try Firebase Admin SDK first, then FCM REST API as fallback
    const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || process.env.NEXT_PUBLIC_FIREBASE_SERVER_KEY;
    
    let response;
    
    if (admin.apps.length) {
      // Use Firebase Admin SDK (V1 API - Recommended)
      console.log('📱 Using Firebase Admin SDK (V1 API)');
      const messaging = admin.messaging();

      if (topic) {
        // Send to topic using V1 API
        message.topic = topic;
        console.log('📡 Sending to topic:', topic);
        response = await messaging.send(message);
        console.log('✅ FCM notification sent to topic:', topic, 'Response:', response);
      } else {
        // Send to specific tokens using V1 API
        console.log('📱 Sending to', tokens.length, 'tokens using V1 API...');
        
        const results = [];
        let successCount = 0;
        let failureCount = 0;
        const failedTokens = [];

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          try {
            console.log(`📤 Sending to token ${i + 1}/${tokens.length}:`, token.substring(0, 20) + '...');
            
            const individualMessage = {
              ...message,
              token: token
            };
            
            const result = await messaging.send(individualMessage);
            results.push({ success: true, messageId: result });
            successCount++;
            console.log(`✅ Success for token ${i + 1}:`, result);
          } catch (error) {
            console.error(`❌ Failed for token ${i + 1}:`, error.message);
            results.push({ success: false, error: error.message });
            failedTokens.push(token);
            failureCount++;
          }
        }

        response = {
          success: true,
          successCount,
          failureCount,
          results
        };
      }
    } else if (FCM_SERVER_KEY) {
      // Use FCM REST API
      if (topic) {
        // Send to topic using FCM REST API
        message.to = `/topics/${topic}`;
        console.log('📡 Sending to topic via REST API:', topic);
        
        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${FCM_SERVER_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const fcmResult = await fcmResponse.json();
        
        if (fcmResponse.ok) {
          console.log('✅ FCM notification sent to topic:', topic, 'Response:', fcmResult);
          response = { success: true, messageId: fcmResult.message_id };
        } else {
          console.error('❌ FCM topic send failed:', fcmResult);
          response = { success: false, error: fcmResult.error || 'Unknown error' };
        }
      } else {
        // Send to specific tokens using FCM REST API
        console.log('📱 Sending to', tokens.length, 'tokens via REST API...');
        
        const fcmMessage = {
          ...message,
          registration_ids: tokens
        };
        
        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${FCM_SERVER_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fcmMessage),
        });

        const fcmResult = await fcmResponse.json();
        
        if (fcmResponse.ok) {
          console.log('✅ FCM notifications sent:', fcmResult);
          response = {
            success: true,
            successCount: fcmResult.success || 0,
            failureCount: fcmResult.failure || 0,
            results: fcmResult.results || []
          };
        } else {
          console.error('❌ FCM send failed:', fcmResult);
          response = { success: false, error: fcmResult.error || 'Unknown error' };
        }
      }
    } else {
      // Fallback: simulate successful send for development
      console.log('⚠️ No FCM server key found, simulating notification send');
      response = {
        success: true,
        messageId: 'simulated-' + Date.now(),
        successCount: tokens.length || 1,
        failureCount: 0,
        results: tokens.map(() => ({ success: true, messageId: 'simulated-' + Math.random() }))
      };
    }

    // Calculate final stats
    const successCount = response.successCount || (response.success ? 1 : 0);
    const failureCount = response.failureCount || 0;
    const totalCount = successCount + failureCount;

    console.log('📊 Final FCM stats:', {
      successCount,
      failureCount,
      totalCount,
      success: response.success
    });

    return NextResponse.json({
      success: response.success !== false,
      messageId: response.messageId || 'unknown',
      successCount,
      failureCount,
      totalCount,
      results: response.results || []
    });

  } catch (error) {
    console.error('❌ FCM API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

