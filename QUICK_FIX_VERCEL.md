# Quick Fix for Vercel Environment Variables

## The Problem
Vercel environment variables aren't being picked up during the build process.

## Solution 1: Verify Variables Are Actually Set (Most Common Issue)

1. **Go to Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. **Check each variable exists** - You should see all 7 variables listed:
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - VITE_FIREBASE_PROJECT_ID
   - VITE_FIREBASE_STORAGE_BUCKET
   - VITE_FIREBASE_MESSAGING_SENDER_ID
   - VITE_FIREBASE_APP_ID
   - VITE_FIREBASE_MEASUREMENT_ID

3. **Click on each variable** to edit it and verify:
   - ✅ The name is **exactly** correct (case-sensitive)
   - ✅ The value is correct (no extra spaces)
   - ✅ **Production** is checked
   - ✅ Click **Save** (even if you didn't change anything)

## Solution 2: Delete and Re-add Variables

Sometimes Vercel has issues with variables. Try:

1. **Delete all Firebase variables** (click the trash icon)
2. **Add them again one by one**
3. Make sure to check **Production** for each
4. **Save** after adding each one
5. **Redeploy** (with cache disabled)

## Solution 3: Use Vercel CLI (Most Reliable)

This is the most reliable method:

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Link your project (if not already linked)
cd /path/to/your/project
vercel link

# 4. Add each variable (you'll be prompted to enter the value)
vercel env add VITE_FIREBASE_API_KEY production
# When prompted, paste: AIzaSyDamWmgBYUfXggdYAhIZskh8FylXftbstc

vercel env add VITE_FIREBASE_AUTH_DOMAIN production
# When prompted, paste: muscule-up.firebaseapp.com

vercel env add VITE_FIREBASE_PROJECT_ID production
# When prompted, paste: muscule-up

vercel env add VITE_FIREBASE_STORAGE_BUCKET production
# When prompted, paste: muscule-up.firebasestorage.app

vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
# When prompted, paste: 320921048765

vercel env add VITE_FIREBASE_APP_ID production
# When prompted, paste: 1:320921048765:web:b27768ea33413c1f4a89d4

vercel env add VITE_FIREBASE_MEASUREMENT_ID production
# When prompted, paste: G-MMTNLMECP0

# 5. Verify they're set
vercel env ls

# 6. Deploy
vercel --prod
```

## Solution 4: Check Build Logs

1. Go to **Deployments** → Click on your latest deployment
2. Click **"Build Logs"**
3. Look for any errors or warnings
4. Search for "VITE_" in the logs
5. If you see the variables mentioned, they're being read

## Solution 5: Force Fresh Build

1. Go to **Settings** → **General**
2. Scroll to **"Build & Development Settings"**
3. Under **"Build Command"**, make sure it's: `npm run build`
4. Under **"Output Directory"**, make sure it's: `dist`
5. **Save**
6. Go to **Deployments**
7. Click **"..."** → **"Redeploy"**
8. **UNCHECK** "Use existing Build Cache"
9. Click **"Redeploy"**

## Solution 6: Temporary Workaround (Hardcode in vercel.json)

If nothing else works, you can temporarily hardcode the values in `vercel.json`:

```json
{
  "build": {
    "env": {
      "VITE_FIREBASE_API_KEY": "AIzaSyDamWmgBYUfXggdYAhIZskh8FylXftbstc",
      "VITE_FIREBASE_AUTH_DOMAIN": "muscule-up.firebaseapp.com",
      "VITE_FIREBASE_PROJECT_ID": "muscule-up",
      "VITE_FIREBASE_STORAGE_BUCKET": "muscule-up.firebasestorage.app",
      "VITE_FIREBASE_MESSAGING_SENDER_ID": "320921048765",
      "VITE_FIREBASE_APP_ID": "1:320921048765:web:b27768ea33413c1f4a89d4",
      "VITE_FIREBASE_MEASUREMENT_ID": "G-MMTNLMECP0"
    }
  }
}
```

**Note**: Firebase API keys are safe to expose (they're public by design), but this is not ideal for production.

## Most Likely Issue

Based on the error, the most common causes are:

1. **Variables not enabled for Production** - Make sure the Production checkbox is checked
2. **Build cache** - You must redeploy with cache disabled
3. **Variables not saved** - Make sure you clicked "Save" after adding each variable
4. **Wrong variable names** - Double-check spelling (case-sensitive)

## Still Not Working?

1. **Check Vercel Status**: [status.vercel.com](https://status.vercel.com)
2. **Contact Vercel Support**: They can check your project configuration
3. **Try a different deployment**: Create a new project and deploy there to test

