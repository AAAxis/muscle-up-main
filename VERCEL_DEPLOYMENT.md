# Vercel Deployment Guide

## Setting up Firebase Environment Variables in Vercel

### Step 1: Add Environment Variables in Vercel Dashboard

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following environment variables (make sure to prefix them with `VITE_`):

```
VITE_FIREBASE_API_KEY=AIzaSyDamWmgBYUfXggdYAhIZskh8FylXftbstc
VITE_FIREBASE_AUTH_DOMAIN=muscule-up.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=muscule-up
VITE_FIREBASE_STORAGE_BUCKET=muscule-up.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=320921048765
VITE_FIREBASE_APP_ID=1:320921048765:web:b27768ea33413c1f4a89d4
VITE_FIREBASE_MEASUREMENT_ID=G-MMTNLMECP0
```

### Step 2: Set Environment for Each Variable

For each variable, make sure to select:
- **Production** ✅
- **Preview** ✅ (optional, for preview deployments)
- **Development** ✅ (optional, for local development)

### Step 3: Redeploy

After adding the environment variables:
1. Go to **Deployments** tab
2. Click the **"..."** menu on your latest deployment
3. Click **"Redeploy"**
4. Or push a new commit to trigger a new deployment

### Step 4: Verify

After redeployment, check the browser console to ensure:
- No "Missing Firebase environment variables" errors
- Firebase initializes correctly
- Authentication works

## Important Notes

1. **VITE_ Prefix**: All environment variables that should be exposed to the client must be prefixed with `VITE_` in Vite projects.

2. **Security**: These variables are exposed to the client, which is normal for Firebase web apps. The Firebase API key is safe to expose (it's restricted by domain in Firebase Console).

3. **Restart Required**: After adding environment variables, you must redeploy for them to take effect.

## Troubleshooting

### Variables not working after deployment?

1. **Check the variable names**: Make sure they start with `VITE_`
2. **Check the environment**: Make sure variables are enabled for Production
3. **Redeploy**: Environment variables only apply to new deployments
4. **Check Vercel logs**: Look for any build errors

### Still getting errors?

1. Verify the values are correct (no extra spaces, correct format)
2. Check that all 7 variables are set
3. Make sure you're looking at the Production deployment (not Preview)
4. Clear browser cache and hard refresh

## Alternative: Using Vercel CLI

You can also set environment variables using the Vercel CLI:

```bash
# Install Vercel CLI if you haven't
npm i -g vercel

# Set environment variables
vercel env add VITE_FIREBASE_API_KEY production
vercel env add VITE_FIREBASE_AUTH_DOMAIN production
vercel env add VITE_FIREBASE_PROJECT_ID production
vercel env add VITE_FIREBASE_STORAGE_BUCKET production
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production
vercel env add VITE_FIREBASE_APP_ID production
vercel env add VITE_FIREBASE_MEASUREMENT_ID production
```

Then redeploy:
```bash
vercel --prod
```

