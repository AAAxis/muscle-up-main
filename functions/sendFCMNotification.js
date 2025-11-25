// Firebase Cloud Function to send FCM notifications
// This file should be placed in your Firebase Functions directory
// Deploy with: firebase deploy --only functions:sendFCMNotification

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin (should already be initialized in index.js)
// If not, uncomment the following:
// admin.initializeApp();

exports.sendFCMNotification = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to send notifications'
    );
  }

  const { userId, userEmail, title, body, data: notificationData, imageUrl } = data;

  // Validate required fields
  if (!title || !body) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Title and body are required'
    );
  }

  if (!userId && !userEmail) {
    throw new functions.https.HttpsError(
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
        throw new functions.https.HttpsError(
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
      throw new functions.https.HttpsError(
        'not-found',
        `No active FCM tokens found for user: ${userId || userEmail}`
      );
    }

    // Prepare notification payload
    const message = {
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

    // Log failures and mark invalid tokens as inactive
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to send to token ${index + 1}:`, result.reason);

        // If token is invalid, mark it as inactive
        if (
          result.reason?.code === 'messaging/invalid-registration-token' ||
          result.reason?.code === 'messaging/registration-token-not-registered'
        ) {
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
      throw new functions.https.HttpsError(
        'internal',
        'All notification attempts failed'
      );
    }

    return {
      success: true,
      message: 'Notification sent successfully',
      sent: successes,
      failed: failures,
      totalTokens: fcmTokens.length,
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError(
      'internal',
      `Error sending notification: ${error.message}`
    );
  }
});

