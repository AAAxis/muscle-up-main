# Setup with Service Account JSON

You have the service account JSON file. Here's how to use it:

## Option 1: Use Service Account JSON (Recommended - More Powerful)

### Step 1: Add to Vercel Environment Variables

1. **Go to Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. **Add New Variable:**
   - **Key**: `FIREBASE_SERVICE_ACCOUNT`
   - **Value**: Copy the **entire contents** of `muscule-up-924cedf05ad5.json` file
   - **Important**: Paste it as a **single-line JSON string** (or it will work as multi-line too)
   - **Environment**: Select all (Production, Preview, Development)

3. **Click Save**

### Step 2: Redeploy

- Go to **Deployments** → Click **⋯** → **Redeploy**
- Or push a new commit

### Step 3: Test

The function will now:
- ✅ Access Firestore directly to get FCM tokens
- ✅ Use Firebase Admin SDK for sending (more reliable)
- ✅ Support `userId` or `userEmail` parameters (no need to pass tokens)

## Option 2: Use FCM Server Key (Simpler but less powerful)

If you prefer the simpler approach:

1. Get FCM Server Key from Firebase Console → Project Settings → Cloud Messaging
2. Add `FCM_SERVER_KEY` environment variable in Vercel
3. Client must pass tokens directly

## Benefits of Service Account Approach

✅ **Automatic token lookup** - No need to pass tokens from client  
✅ **More reliable** - Uses Firebase Admin SDK  
✅ **Better error handling** - More detailed error messages  
✅ **Direct Firestore access** - Can query tokens directly  

## Security Note

⚠️ **The service account JSON file contains sensitive credentials:**
- ✅ Already added to `.gitignore`
- ⚠️ If it was committed to git, remove it: `git rm --cached muscule-up-924cedf05ad5.json`
- ⚠️ If pushed to GitHub, rotate the key in Firebase Console

## Usage Example

With service account, you can call the API like this:

```javascript
// From client - no need to get tokens first!
fetch('/api/send-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user123',  // or userEmail: 'user@example.com'
    title: 'Test',
    body: 'Message'
  })
})
```

The function will automatically:
1. Look up FCM tokens from Firestore
2. Send notifications using Admin SDK

