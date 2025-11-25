# FCM Notification Setup Guide

Complete step-by-step guide to set up FCM notifications for your app.

## Prerequisites

✅ Your Flutter app is already saving FCM tokens to Firestore (in `fcm_tokens` collection)  
✅ Your web app is deployed on Vercel  
✅ You have access to Firebase Console and Vercel Dashboard

---

## Step 1: Get FCM Server Key from Firebase

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select your project: **muscule-up**

2. **Navigate to Project Settings**
   - Click the ⚙️ **gear icon** (top left)
   - Select **Project Settings**

3. **Go to Cloud Messaging Tab**
   - Click on the **Cloud Messaging** tab
   - Scroll down to find **Cloud Messaging API (Legacy)** section

4. **Copy the Server Key**
   - Find the **Server key** field
   - Click **Copy** to copy the key
   - ⚠️ **Keep this key secure** - you'll need it in the next step

   **Note:** If you don't see the Server key:
   - Make sure Cloud Messaging API is enabled
   - You might need to enable it in Google Cloud Console first

---

## Step 2: Add Environment Variable in Vercel

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: **muscle-up-main**

2. **Navigate to Settings**
   - Click on your project
   - Go to **Settings** tab (top navigation)

3. **Go to Environment Variables**
   - Click on **Environment Variables** in the left sidebar

4. **Add New Variable**
   - Click **Add New** button
   - Fill in:
     - **Key**: `FCM_SERVER_KEY`
     - **Value**: Paste the Server key you copied from Firebase
     - **Environment**: Select all three:
       - ✅ Production
       - ✅ Preview  
       - ✅ Development
   - Click **Save**

---

## Step 3: Redeploy Your Application

After adding the environment variable, you need to redeploy:

### Option A: Redeploy from Vercel Dashboard
1. Go to **Deployments** tab
2. Find your latest deployment
3. Click the **⋯** (three dots) menu
4. Click **Redeploy**
5. Wait for deployment to complete

### Option B: Push a New Commit
```bash
# Make a small change and push
git commit --allow-empty -m "Trigger redeploy for FCM setup"
git push
```

---

## Step 4: Verify Setup

### Check Vercel Function Logs
1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click on the latest deployment
3. Go to **Functions** tab
4. Click on `api/send-notification`
5. Check the logs - you should see initialization messages

### Test from Web App
1. Open your web app
2. Go to User Management page
3. Click **"שלח תזכורת"** (Send Reminder) button for a user
4. Check browser console for success/error messages
5. Check mobile device for the notification

---

## Step 5: Verify FCM Tokens in Firestore

Make sure your Flutter app is saving FCM tokens:

1. **Go to Firebase Console** → **Firestore Database**
2. **Check `fcm_tokens` collection**
   - Should have documents with:
     - `userId`: User's document ID
     - `token`: FCM token string
     - `active`: `true`
     - `platform`: `"ios"` or `"android"`

3. **Or check `users` collection**
   - User documents might have `fcm_token` field

---

## Troubleshooting

### ❌ Error: "FCM Server Key not configured"
**Solution:**
- Make sure `FCM_SERVER_KEY` is set in Vercel
- Make sure you redeployed after adding the variable
- Check that the key is correct (no extra spaces)

### ❌ Error: "No FCM token found"
**Solution:**
- Check Firestore `fcm_tokens` collection has entries
- Verify tokens have `active: true`
- Check that `userId` matches the user's document ID
- Make sure Flutter app is saving tokens correctly

### ❌ Error: "FCM API error" or "401 Unauthorized"
**Solution:**
- Verify the Server key is correct
- Make sure Cloud Messaging API is enabled in Firebase
- Check that the key hasn't been regenerated

### ❌ Notifications not appearing on device
**Solution:**
- Check device has notifications enabled for the app
- Verify FCM token is valid and active
- Check Vercel function logs for errors
- Make sure the app is properly configured for FCM (iOS/Android)

---

## How It Works

```
┌─────────────┐
│  Web App    │
│  (Client)   │
└──────┬──────┘
       │
       │ 1. Get FCM tokens from Firestore
       │
       ▼
┌─────────────────┐
│  Firestore      │
│  fcm_tokens     │
└──────┬──────────┘
       │
       │ 2. Send tokens + notification data
       │
       ▼
┌─────────────────────┐
│  Vercel Function    │
│  /api/send-         │
│  notification       │
└──────┬──────────────┘
       │
       │ 3. Use FCM REST API
       │
       ▼
┌─────────────────┐
│  FCM Service    │
│  (Google)       │
└──────┬──────────┘
       │
       │ 4. Push notification
       │
       ▼
┌─────────────┐
│  Mobile App │
│  (Flutter)  │
└─────────────┘
```

---

## Testing

### Test from Browser Console
```javascript
// Test the API directly
fetch('/api/send-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokens: ['YOUR_FCM_TOKEN_HERE'],
    title: 'Test Notification',
    body: 'This is a test notification'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

### Test from UserManagement Component
1. Open User Management page
2. Find a user with an FCM token
3. Click "שלח תזכורת" button
4. Check console and mobile device

---

## Next Steps

✅ Setup complete! You can now:
- Send notifications from UserManagement component
- Send notifications programmatically using `SendFCMNotification()`
- Customize notification content (title, body, data, image)

---

## Support

If you encounter issues:
1. Check Vercel function logs
2. Check browser console for errors
3. Verify FCM tokens exist in Firestore
4. Test with a single token first

