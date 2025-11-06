# Quick Setup: Firebase Environment Variables in Vercel

## 🔧 Step-by-Step Instructions

### 1. Go to Vercel Dashboard
- Open your project in [Vercel Dashboard](https://vercel.com/dashboard)
- Click on your project

### 2. Navigate to Environment Variables
- Click **Settings** (in the top menu)
- Click **Environment Variables** (in the left sidebar)

### 3. Add Each Variable

Click **"Add New"** and add each of these variables one by one:

| Variable Name | Value |
|--------------|-------|
| `VITE_FIREBASE_API_KEY` | `AIzaSyDamWmgBYUfXggdYAhIZskh8FylXftbstc` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `muscule-up.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `muscule-up` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `muscule-up.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `320921048765` |
| `VITE_FIREBASE_APP_ID` | `1:320921048765:web:b27768ea33413c1f4a89d4` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-MMTNLMECP0` |

### 4. Important: Set Environment for Each Variable

For **each variable**, make sure to check:
- ✅ **Production**
- ✅ **Preview** (optional)
- ✅ **Development** (optional)

### 5. Save and Redeploy

1. After adding all variables, click **Save**
2. Go to **Deployments** tab
3. Click the **"..."** (three dots) on your latest deployment
4. Click **"Redeploy"**
5. Make sure **"Use existing Build Cache"** is **unchecked**
6. Click **"Redeploy"**

### 6. Verify

After redeployment completes:
- Open your deployed site
- Check browser console (F12)
- You should **NOT** see "Missing Firebase environment variables" error
- Firebase should initialize correctly

## ⚠️ Common Mistakes

1. **Missing VITE_ prefix**: Variables MUST start with `VITE_` for Vite to expose them
2. **Not enabled for Production**: Make sure Production checkbox is checked
3. **Forgot to redeploy**: Environment variables only apply to NEW deployments
4. **Typos in variable names**: Double-check spelling (case-sensitive)

## 🚀 Quick Copy-Paste (CLI Method)

If you prefer using Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Set all variables at once
vercel env add VITE_FIREBASE_API_KEY production <<< "AIzaSyDamWmgBYUfXggdYAhIZskh8FylXftbstc"
vercel env add VITE_FIREBASE_AUTH_DOMAIN production <<< "muscule-up.firebaseapp.com"
vercel env add VITE_FIREBASE_PROJECT_ID production <<< "muscule-up"
vercel env add VITE_FIREBASE_STORAGE_BUCKET production <<< "muscule-up.firebasestorage.app"
vercel env add VITE_FIREBASE_MESSAGING_SENDER_ID production <<< "320921048765"
vercel env add VITE_FIREBASE_APP_ID production <<< "1:320921048765:web:b27768ea33413c1f4a89d4"
vercel env add VITE_FIREBASE_MEASUREMENT_ID production <<< "G-MMTNLMECP0"

# Redeploy
vercel --prod
```

## 📝 Notes

- Environment variables are **case-sensitive**
- The `VITE_` prefix is **required** for Vite to expose variables to the client
- You must **redeploy** after adding/changing environment variables
- These variables are safe to expose (Firebase API keys are public by design)

