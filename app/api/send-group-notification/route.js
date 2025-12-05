// API endpoint to send push notifications to all members of a group
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
          console.warn('⚠️ No Firebase Admin credentials found.');
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
      console.log('⚠️ Firebase Admin SDK not initialized');
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
}

// Initialize on module load
initializeAdmin();

// Next.js-style response helper
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
      groupName,
      title, 
      body: messageBody, 
      data = {},
      imageUrl
    } = requestBody;

    console.log('📱 Group FCM API called with:', {
      groupName,
      title,
      body: messageBody?.substring(0, 50) + '...',
      hasImageUrl: !!imageUrl
    });

    // Validation
    if (!groupName) {
      console.error('❌ Validation failed: Group name is required');
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    if (!title || !messageBody) {
      console.error('❌ Validation failed: Title and body are required');
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    if (!admin.apps.length) {
      console.error('❌ Firebase Admin SDK not initialized');
      return NextResponse.json(
        { error: 'Firebase Admin SDK not initialized' },
        { status: 500 }
      );
    }

    // Get Firestore instance
    const db = admin.firestore();

    // Query users in the group
    // Users have group_names as an array field
    const usersSnapshot = await db.collection('users')
      .where('group_names', 'array-contains', groupName)
      .get();

    if (usersSnapshot.empty) {
      console.log(`⚠️ No users found in group: ${groupName}`);
      return NextResponse.json({
        success: true,
        message: `No users found in group: ${groupName}`,
        successCount: 0,
        failureCount: 0,
        totalCount: 0
      });
    }

    console.log(`📊 Found ${usersSnapshot.size} users in group: ${groupName}`);

    // Collect all FCM tokens from users
    const allTokens = [];
    const userResults = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const userTokens = [];

      // Try to get tokens from fcm_tokens collection
      const tokensSnapshot = await db.collection('fcm_tokens')
        .where('userId', '==', userId)
        .where('active', '==', true)
        .limit(10)
        .get();

      if (!tokensSnapshot.empty) {
        tokensSnapshot.forEach(tokenDoc => {
          const token = tokenDoc.data().token;
          if (token) {
            userTokens.push(token);
            allTokens.push(token);
          }
        });
      } else if (userData.fcm_token) {
        // Fallback to user document fcm_token field
        userTokens.push(userData.fcm_token);
        allTokens.push(userData.fcm_token);
      }

      userResults.push({
        userId,
        email: userData.email || 'unknown',
        name: userData.name || 'unknown',
        tokenCount: userTokens.length,
        hasToken: userTokens.length > 0
      });
    }

    // Remove duplicate tokens
    const uniqueTokens = [...new Set(allTokens)];

    if (uniqueTokens.length === 0) {
      console.log(`⚠️ No FCM tokens found for users in group: ${groupName}`);
      return NextResponse.json({
        success: true,
        message: `No FCM tokens found for users in group: ${groupName}`,
        successCount: 0,
        failureCount: 0,
        totalCount: usersSnapshot.size,
        userResults
      });
    }

    console.log(`📱 Sending notifications to ${uniqueTokens.length} tokens from ${usersSnapshot.size} users`);

    // Build notification payload
    const message = {
      notification: {
        title,
        body: messageBody,
        ...(imageUrl && { imageUrl })
      },
      data: {
        ...data,
        timestamp: Date.now().toString(),
        source: 'dashboard',
        groupName: groupName
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'vitrix_notifications',
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

    // Send notifications using Firebase Admin SDK
    const messaging = admin.messaging();
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    const failedTokens = [];

    // Send to each token individually for better error tracking
    for (let i = 0; i < uniqueTokens.length; i++) {
      const token = uniqueTokens[i];
      try {
        const individualMessage = {
          ...message,
          token: token
        };
        
        const result = await messaging.send(individualMessage);
        results.push({ success: true, messageId: result, token: token.substring(0, 20) + '...' });
        successCount++;
      } catch (error) {
        console.error(`❌ Failed for token ${i + 1}:`, error.message);
        results.push({ success: false, error: error.message, token: token.substring(0, 20) + '...' });
        failedTokens.push(token);
        failureCount++;
      }
    }

    console.log('📊 Final group notification stats:', {
      groupName,
      totalUsers: usersSnapshot.size,
      totalTokens: uniqueTokens.length,
      successCount,
      failureCount
    });

    return NextResponse.json({
      success: true,
      groupName,
      totalUsers: usersSnapshot.size,
      totalTokens: uniqueTokens.length,
      successCount,
      failureCount,
      results,
      userResults
    });

  } catch (error) {
    console.error('❌ Group notification API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
