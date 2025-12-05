// API endpoint to send emails to all members of a group
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
      userEmail: targetUserEmail, // Optional: for single user email
      title = 'הודעה מהמאמן',
      message = ''
    } = requestBody;

    console.log('📧 Group Email API called with:', {
      groupName,
      targetUserEmail,
      title,
      message: message?.substring(0, 50) + '...'
    });

    // Validation
    if (!groupName && !targetUserEmail) {
      console.error('❌ Validation failed: Either group name or user email is required');
      return NextResponse.json(
        { error: 'Either group name or user email is required' },
        { status: 400 }
      );
    }

    if (!title || !message) {
      console.error('❌ Validation failed: Title and message are required');
      return NextResponse.json(
        { error: 'Title and message are required' },
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

    let usersSnapshot;

    // Handle single user email or group email
    if (targetUserEmail) {
      // Single user email
      const userQuery = await db.collection('users')
        .where('email', '==', targetUserEmail)
        .limit(1)
        .get();
      
      usersSnapshot = userQuery;
    } else {
      // Group email
      usersSnapshot = await db.collection('users')
        .where('group_names', 'array-contains', groupName)
        .get();
    }

    if (usersSnapshot.empty) {
      const target = targetUserEmail ? `user: ${targetUserEmail}` : `group: ${groupName}`;
      console.log(`⚠️ No users found for ${target}`);
      return NextResponse.json({
        success: true,
        message: `No users found for ${target}`,
        successCount: 0,
        failureCount: 0,
        totalCount: 0
      });
    }

    const target = targetUserEmail ? `user: ${targetUserEmail}` : `group: ${groupName}`;
    console.log(`📊 Found ${usersSnapshot.size} users for ${target}`);

    // Use Roamjet API to send emails
    const roamjetProjectId = process.env.ROAMJET_PROJECT_ID || 'eZl22S3z7Pl0oGA01qyH';
    const roamjetTemplateId = process.env.ROAMJET_TEMPLATE_ID || 'lbbVwGT1BLMw87C3oHbI';
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Send email to each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userEmail = userData.email;
      const userName = userData.name || 'מתאמן/ת';

      if (!userEmail) {
        console.warn(`⚠️ User ${userDoc.id} has no email address`);
        results.push({
          userId: userDoc.id,
          email: null,
          name: userName,
          success: false,
          error: 'No email address'
        });
        failureCount++;
        continue;
      }

      try {
        // Build email message with personalized greeting
        const emailTitle = title;
        const emailText = `שלום ${userName},\n\n${message}`;

        // Send email via Roamjet API
        const roamjetUrl = new URL('https://smtp.roamjet.net/api/email/send');
        roamjetUrl.searchParams.set('email', userEmail);
        roamjetUrl.searchParams.set('project_id', roamjetProjectId);
        roamjetUrl.searchParams.set('template_id', roamjetTemplateId);
        roamjetUrl.searchParams.set('title', emailTitle);
        roamjetUrl.searchParams.set('text', emailText);

        console.log(`📧 Sending email to: ${userEmail}`);

        const roamjetRes = await fetch(roamjetUrl.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const emailRes = await roamjetRes.json();

        if (roamjetRes.ok) {
          console.log(`✅ Email sent successfully to: ${userEmail}`);
          results.push({
            userId: userDoc.id,
            email: userEmail,
            name: userName,
            success: true,
            messageId: emailRes.messageId || 'sent'
          });
          successCount++;
        } else {
          console.error(`❌ Email send failed for ${userEmail}:`, emailRes);
          results.push({
            userId: userDoc.id,
            email: userEmail,
            name: userName,
            success: false,
            error: emailRes.error || 'Failed to send email'
          });
          failureCount++;
        }
      } catch (error) {
        console.error(`❌ Error sending email to ${userEmail}:`, error);
        results.push({
          userId: userDoc.id,
          email: userEmail,
          name: userName,
          success: false,
          error: error.message || 'Unknown error'
        });
        failureCount++;
      }
    }

    console.log('📊 Final group email stats:', {
      groupName,
      totalUsers: usersSnapshot.size,
      successCount,
      failureCount
    });

    return NextResponse.json({
      success: true,
      groupName,
      totalUsers: usersSnapshot.size,
      successCount,
      failureCount,
      results
    });

  } catch (error) {
    console.error('❌ Group email API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
