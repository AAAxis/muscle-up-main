# Vercel Environment Variables Troubleshooting

## Problem: Variables Not Loading After Setting in Vercel

If you've added environment variables in Vercel but they're still not working, try these steps:

### Step 1: Verify Variables Are Set Correctly

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Verify each variable:
   - ✅ Name starts with `VITE_`
   - ✅ Value is correct (no extra spaces)
   - ✅ **Production** checkbox is checked
   - ✅ Variable is saved (clicked "Save" button)

### Step 2: Check Variable Names

Make sure the variable names are **exactly**:
- `VITE_FIREBASE_API_KEY` (not `FIREBASE_API_KEY` or `VITE_FIREBASE_APIKEY`)
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

### Step 3: Force a Fresh Deployment

**Important**: Environment variables are only available during the **build** process. You need to:

1. Go to **Deployments** tab
2. Click **"..."** (three dots) on the latest deployment
3. Click **"Redeploy"**
4. **IMPORTANT**: Make sure **"Use existing Build Cache"** is **UNCHECKED** ❌
5. Click **"Redeploy"**

### Step 4: Check Build Logs

1. Go to **Deployments** tab
2. Click on your deployment
3. Click on **"Build Logs"**
4. Look for any errors related to environment variables
5. Check if variables are being read (they won't show values, but you can see if they're referenced)

### Step 5: Verify in Vercel CLI (Alternative Method)

If dashboard isn't working, try CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# List current environment variables
vercel env ls

# If variables are missing, add them:
vercel env add VITE_FIREBASE_API_KEY production
# (paste the value when prompted)

# Repeat for all variables, then:
vercel --prod
```

### Step 6: Check for Typos or Extra Spaces

Common issues:
- Extra spaces before/after variable names
- Extra spaces before/after values
- Missing `VITE_` prefix
- Wrong environment selected (should be Production)

### Step 7: Try Adding to All Environments

Sometimes it helps to add variables to all environments:
1. Edit each variable
2. Check **Production**, **Preview**, and **Development**
3. Save
4. Redeploy

### Step 8: Clear Build Cache Completely

1. Go to **Settings** → **General**
2. Scroll to **"Build & Development Settings"**
3. Check **"Override"** for Build Command
4. Set to: `npm run build`
5. Save
6. Redeploy with cache disabled

### Step 9: Verify Build Output

Check if Vite is actually reading the variables during build:

1. Look at build logs
2. Search for "VITE_" in the logs
3. If you see the variables mentioned, they're being read
4. If not, they're not being passed to the build

### Step 10: Alternative - Use vercel.json

Create a `vercel.json` file in your project root:

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

**Note**: This exposes values in your repo. Only use if you're okay with that (Firebase API keys are safe to expose).

## Still Not Working?

1. **Check Vercel Status**: Visit [status.vercel.com](https://status.vercel.com)
2. **Contact Vercel Support**: They can check your project settings
3. **Try a Different Approach**: Use `vercel.json` as a temporary workaround

## Quick Checklist

- [ ] Variables added in Vercel Dashboard
- [ ] All variables start with `VITE_`
- [ ] Production environment is checked
- [ ] Variables are saved (not just typed)
- [ ] Redeployed after adding variables
- [ ] Build cache was disabled during redeploy
- [ ] Checked build logs for errors
- [ ] Verified variable names are exact (case-sensitive)

