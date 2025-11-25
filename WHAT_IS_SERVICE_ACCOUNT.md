# What is FIREBASE_SERVICE_ACCOUNT?

## Simple Explanation

`FIREBASE_SERVICE_ACCOUNT` is an **environment variable** in Vercel that contains your Firebase service account credentials (the JSON file you have).

## What is a Service Account?

A **Firebase Service Account** is like a special user account that:
- ✅ Gives your server (Vercel function) permission to access Firebase services
- ✅ Allows reading/writing to Firestore
- ✅ Allows sending FCM notifications
- ✅ Works server-side only (not exposed to clients)

## Your Service Account File

You have: `muscule-up-924cedf05ad5.json`

This file contains:
- `project_id`: Your Firebase project ID
- `private_key`: Secret key for authentication
- `client_email`: Service account email
- Other authentication details

## How to Use It in Vercel

### Step 1: Copy the JSON Content

Open `muscule-up-924cedf05ad5.json` and copy **ALL** the content:

```json
{
  "type": "service_account",
  "project_id": "muscule-up",
  "private_key_id": "924cedf05ad5d038f57f098f58b2bbb30cc59626",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-fbsvc@muscule-up.iam.gserviceaccount.com",
  ...
}
```

### Step 2: Add to Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Click **Add New**

3. Fill in:
   - **Key**: `FIREBASE_SERVICE_ACCOUNT`
   - **Value**: Paste the **entire JSON** (all 14 lines)
   - **Environment**: Select all (Production, Preview, Development)

4. Click **Save**

### Step 3: How It Works

When your Vercel function runs, it will:
1. Read `process.env.FIREBASE_SERVICE_ACCOUNT`
2. Parse the JSON string
3. Use it to authenticate with Firebase
4. Access Firestore and send FCM notifications

## Example in Code

```javascript
// In your Vercel function (api/send-notification.js)
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT; // Gets the JSON string
const serviceAccount = JSON.parse(serviceAccountJson); // Converts to object

// Use it to initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```

## Why Use Environment Variables?

✅ **Security**: Keeps credentials out of your code  
✅ **Flexibility**: Different values for dev/staging/production  
✅ **Easy Updates**: Change without redeploying code  

## Alternative: FCM_SERVER_KEY

If you don't want to use the service account, you can use:
- **FCM_SERVER_KEY**: Just a simple string key (simpler but less powerful)

But the service account is better because it:
- ✅ Can access Firestore directly
- ✅ More reliable
- ✅ Better error handling

## Security Warning

⚠️ **Never commit the JSON file to git!**
- ✅ Already in `.gitignore`
- ⚠️ If already committed, remove it immediately
- ⚠️ If pushed to GitHub, rotate the key in Firebase Console

## Quick Setup Checklist

- [ ] Copy entire JSON from `muscule-up-924cedf05ad5.json`
- [ ] Go to Vercel → Settings → Environment Variables
- [ ] Add `FIREBASE_SERVICE_ACCOUNT` with the JSON as value
- [ ] Select all environments
- [ ] Save
- [ ] Redeploy your project
- [ ] Test sending a notification

That's it! 🎉

