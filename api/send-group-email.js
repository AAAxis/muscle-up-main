// Vercel serverless: POST /api/send-group-email
// Sends emails to a group or single user via Roamjet. Used by dashboard (booster, group messaging, etc.)
import admin from 'firebase-admin';
import fs from 'fs';

let adminInitialized = false;

async function initializeAdmin() {
  if (adminInitialized || admin.apps.length) return;
  try {
    if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'muscule-up',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'muscule-up',
      });
      adminInitialized = true;
    } else if (fs.existsSync('./muscule-up-924cedf05ad5.json')) {
      admin.initializeApp({
        credential: admin.credential.cert('./muscule-up-924cedf05ad5.json'),
        projectId: process.env.FIREBASE_PROJECT_ID || 'muscule-up',
      });
      adminInitialized = true;
    }
  } catch (e) {
    console.warn('Firebase Admin init:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  await initializeAdmin();

  try {
    const { groupName, userEmail: targetUserEmail, title = 'הודעה מהמאמן', message = '' } = req.body || {};

    if (!groupName && !targetUserEmail) {
      res.status(400).json({ error: 'Either group name or user email is required' });
      return;
    }
    if (!title || !message) {
      res.status(400).json({ error: 'Title and message are required' });
      return;
    }

    if (!admin.apps.length) {
      console.error('❌ [send-group-email] Firebase Admin SDK not initialized');
      res.status(500).json({ error: 'Firebase Admin SDK not initialized' });
      return;
    }

    const db = admin.firestore();
    let usersSnapshot;

    if (targetUserEmail) {
      usersSnapshot = await db.collection('users').where('email', '==', targetUserEmail).limit(1).get();
    } else {
      usersSnapshot = await db.collection('users').where('group_names', 'array-contains', groupName).get();
    }

    if (usersSnapshot.empty) {
      const target = targetUserEmail ? `user: ${targetUserEmail}` : `group: ${groupName}`;
      res.status(200).json({
        success: true,
        message: `No users found for ${target}`,
        successCount: 0,
        failureCount: 0,
        totalCount: 0,
        results: [],
      });
      return;
    }

    const roamjetProjectId = process.env.ROAMJET_PROJECT_ID || 'eZl22S3z7Pl0oGA01qyH';
    const roamjetTemplateId = process.env.ROAMJET_TEMPLATE_ID || 'lbbVwGT1BLMw87C3oHbI';

    const results = [];
    let successCount = 0;
    let failureCount = 0;

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
        const emailTitle = title;
        const emailText = `שלום ${userName},\n\n${message}`;
        const roamjetUrl = new URL('https://smtp.roamjet.net/api/email/send');
        roamjetUrl.searchParams.set('email', userEmail);
        roamjetUrl.searchParams.set('project_id', roamjetProjectId);
        roamjetUrl.searchParams.set('template_id', roamjetTemplateId);
        roamjetUrl.searchParams.set('title', emailTitle);
        roamjetUrl.searchParams.set('text', emailText);

        const roamjetRes = await fetch(roamjetUrl.toString(), {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const emailRes = await roamjetRes.json();

        if (roamjetRes.ok) {
          results.push({ userId: userDoc.id, email: userEmail, name: userName, success: true, messageId: emailRes.messageId || 'sent' });
          successCount++;
        } else {
          results.push({ userId: userDoc.id, email: userEmail, name: userName, success: false, error: emailRes.error || 'Failed to send email' });
          failureCount++;
        }
      } catch (error) {
        results.push({ userId: userDoc.id, email: userEmail, name: userName, success: false, error: error.message || 'Unknown error' });
        failureCount++;
      }
    }

    res.status(200).json({
      success: true,
      groupName: groupName || null,
      totalUsers: usersSnapshot.size,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    console.error('❌ send-group-email error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
