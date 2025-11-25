# Firebase Cloud Function Setup for FCM Notifications

Since you're using client-side only, you need to create a Firebase Cloud Function to send FCM notifications.

## Setup Instructions

### 1. Initialize Firebase Functions (if not already done)

```bash
cd /path/to/your/project
firebase init functions
```

Select:
- JavaScript (or TypeScript if you prefer)
- Install dependencies with npm

### 2. Install Dependencies

```bash
cd functions
npm install firebase-admin firebase-functions
```

### 3. Add the Function

Copy the `sendFCMNotification.js` file to your `functions/index.js` or add it as a separate file and import it.

If using `functions/index.js`, add this code:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Copy the sendFCMNotification function code here
// (from functions/sendFCMNotification.js)
```

### 4. Deploy the Function

```bash
firebase deploy --only functions:sendFCMNotification
```

### 5. Verify Deployment

After deployment, the function will be available at:
`https://us-central1-<your-project-id>.cloudfunctions.net/sendFCMNotification`

The client code will automatically call it using `httpsCallable`.

## Alternative: Quick Setup

If you already have a `functions` directory:

1. Copy `functions/sendFCMNotification.js` to your `functions/index.js`
2. Make sure `firebase-admin` and `firebase-functions` are in `functions/package.json`
3. Run `firebase deploy --only functions`

## Testing

After deployment, test by clicking the "שלח תזכורת" button in UserManagement. Check:
- Browser console for success/error messages
- Firebase Functions logs in Firebase Console
- Mobile device for the notification

## Troubleshooting

- **Function not found**: Make sure you deployed the function with the exact name `sendFCMNotification`
- **Permission denied**: The function requires authentication - make sure the user is logged in
- **No tokens found**: Check that FCM tokens are being saved to Firestore in the `fcm_tokens` collection

