# Environment Variables Setup

You've set `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` - perfect! Here's what you need:

## Required Environment Variables in Vercel

### Option 1: Separate Variables (What You Have) ✅

1. **FIREBASE_CLIENT_EMAIL**
   - Value: `firebase-adminsdk-fbsvc@muscule-up.iam.gserviceaccount.com`
   - (From line 6 of your JSON file)

2. **FIREBASE_PRIVATE_KEY**
   - Value: The entire private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
   - (From line 5 of your JSON file)
   - **Important**: Make sure newlines are preserved or escaped as `\n`

3. **FIREBASE_PROJECT_ID** (Optional but recommended)
   - Value: `muscule-up`
   - (From line 3 of your JSON file)

### Option 2: Full JSON (Alternative)

- **FIREBASE_SERVICE_ACCOUNT**: Entire JSON file content

### Option 3: Simple Key (Fallback)

- **FCM_SERVER_KEY**: FCM Server Key from Firebase Console

## How to Set in Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Add these variables:

   **Variable 1:**
   - Key: `FIREBASE_CLIENT_EMAIL`
   - Value: `firebase-adminsdk-fbsvc@muscule-up.iam.gserviceaccount.com`
   - Environment: All

   **Variable 2:**
   - Key: `FIREBASE_PRIVATE_KEY`
   - Value: 
     ```
     -----BEGIN PRIVATE KEY-----
     MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDGwz7b8GjL9HR0
     ERWd+meBhnD+ypQ8uZ5qYSFGNd6nHIDod8QUhGTo4ucdZ7X+f/IOSuwBrqMxEeet
     fJyiAK127x6wWc1CWBDwYyoUW9ibstOBkXWigSI51scnbB7J+O0tvElpldeacrUA
     tqxj3i3R6y+SKVuQpKsRKZCH9Ub2gkdS9t2xC8bt8FHiTBKTuDCt+UAt2SzEqF5/
     WQcxLdqAtvHCs+ts4hr5yCho4rlujXX0hZgKZqvngnfM2H8VOswEGY6dUkLPcwgR
     qFOgX/yRgbVQRlLO+Sysp3KBCTiFh81qvtbLimSdkU7ehm+/T80BXTuQE2qSFDWn
     RU2b5z3bAgMBAAECggEAG+lBA3ugC7v5Om9HvNZ0AIFTjsP9ywU51LBtDsHz0T20
     cHCZDVSGIxnx4HQ231UyNYWZ3KacbgCYqwkLqcg0k7YCdjs2ErHxNwCF4TQAl+Sl
     xNUbUsWVe8/ISaXqMOyOydRd7sDG9P5UopQEY0XI42iGVp0OKaKmDxPqIt1zqJvl
     To/cvyhPdETW5mWUBRY1RLm0GCd6vTSXlkT+BIwgkPjDm3gufy3jMaZ2fzxjvcDG
     wQwPAe13wv7pay3Jd2GMEd2PtdSo9TyO0KOl45Z+HuN6sug1LfBPreZ/uNaPQamB
     FhgMkDDigNXwhU45J/CoXDYxhxVpQ2zNzXs3YGbvmQKBgQDxYlPdDW+ATCGBv4TS
     vCxqmyRVg0/NBfGjda097069hCAjM3uRKyWCAlXREsltFDHnSnKIIeNpCW/PLy8U
     oSc64Ze5sVkRvKi4I1c85mwQz6U0sSxwruOHjS+8JNgoRM7WQUtQH9bcxpi7IsnD
     Y4miaSdwpS9en0bPlbSK1u3O5wKBgQDSzD9TVqrAZhq4kXoLqqSavItKP9encC1Z
     IC/MN/4SBiYhwO9clVgOc2GJG/4CqWYydLLlrrIdG1zkB85IgxHGK50TjgZpIKgY
     irDud/XSElG8HIC4bG25bGePqENriscv3TqYGvT2+fr1nVcSm/sfIzljZxhxvEd0
     FJjU6q9+7QKBgHGse4/7Nso1kAX5OkS/py8hFpBKwXbs2KnAzi//lZY8NaI+KW/o
     4MYD8YP/E+qRexrP/XXMd7rMXeI09zgA2GerO3eQZECtFst4oSml3bhhAQz6btI2
     GiKIw7UXqM/1724I273E8LuRrvVZ4ahpJLTeTluG/vLRkVhKyPYlV2J7AoGBALQ5
     rGq0TojwwyfKOW6AFvu09+Ijc13UqvDoc/VGahM+7pstOXkOtpqkS1/Obv4XlyjM
     XafCFMaN/n13rwaQCUJFR6bQZuq64P0alutL5QAWaYtLU0JacfV2mZRZaEsp++MQ
     Ymhpo8cFM2uLekaO1cVpeEdkfaHAN9cnRQPFIwaBAoGBAOgcfYeR+FuPj/fPyIhu
     817cGvlDjNsnNUmJeTrkNunV/J8q9tiLQAo6lu25kY80FOxipQuWLBKFhsp/pM46
     VJBm2H7vSWDEF9AfTUeSm+JvT6vtHLVVkoi7zrD7GRMw7bHD8rbPTRHJoZA3/ST5
     eCjwo4lVc4jF+AGif4Bz6cdQ
     -----END PRIVATE KEY-----
     ```
   - Environment: All

   **Variable 3 (Optional):**
   - Key: `FIREBASE_PROJECT_ID`
   - Value: `muscule-up`
   - Environment: All

3. Click **Save** for each variable

4. **Redeploy** your project

## Important Notes

⚠️ **Private Key Format:**
- Vercel environment variables can handle multi-line values
- Make sure the private key includes the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
- The code will automatically handle `\n` if Vercel escapes newlines

## Testing

After redeploying, test by:
1. Going to User Management
2. Clicking "שלח תזכורת" (Send Reminder)
3. Check Vercel function logs to see if Admin SDK initialized successfully

## Troubleshooting

If you see errors:
- Check that both `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` are set
- Verify the private key is complete (starts with `-----BEGIN` and ends with `-----END`)
- Check Vercel function logs for initialization errors

