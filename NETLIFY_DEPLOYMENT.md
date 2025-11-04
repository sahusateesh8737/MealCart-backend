# Netlify Deployment Guide - MealCart Backend

## 🚨 Error: "Something went wrong!"

If you're getting this error on your Netlify deployment at `https://mealcartbackend.netlify.app/api/ai/chat`, it's likely due to **missing environment variables**.

---

## ✅ Fix: Set Environment Variables in Netlify

### Step 1: Go to Netlify Dashboard
1. Visit [https://app.netlify.com](https://app.netlify.com)
2. Click on your site: **mealcartbackend**
3. Go to **Site settings** → **Environment variables**

### Step 2: Add Required Environment Variables

Click **"Add a variable"** and add these:

| Variable Name | Value | Required |
|--------------|-------|----------|
| `GEMINI_API_KEY` | Your Google Gemini API key | ✅ Yes (for AI chat) |
| `JWT_SECRET` | Your JWT secret (e.g., `your-super-secret-jwt-key-change-this-in-production`) | ✅ Yes |
| `MONGODB_URI` | Your MongoDB connection string | ✅ Yes |
| `FRONTEND_URL` | `https://meal-cart-phi.vercel.app` | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |
| `PORT` | `5000` | Optional |

### Step 3: Get Your API Keys

#### GEMINI_API_KEY
1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Copy the key
4. Add it to Netlify environment variables

#### MONGODB_URI
Your current MongoDB URI (from your local `.env`):
```
mongodb+srv://vercel-admin-user:HulK12@cluster0.d2r2u.mongodb.net/mealcart
```

#### JWT_SECRET
Use a strong random string. You can generate one:
```bash
# On Mac/Linux
openssl rand -base64 32
```

### Step 4: Redeploy
After adding environment variables:
1. Go to **Deploys** tab
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait for deployment to complete (2-3 minutes)

---

## 🧪 Test Your Deployment

### 1. Check Health Endpoint
```bash
curl https://mealcartbackend.netlify.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "geminiConfigured": true,
  "jwtConfigured": true,
  "timestamp": "2025-11-04T05:45:00.948Z"
}
```

⚠️ If `geminiConfigured: false` or `jwtConfigured: false`, your environment variables are not set correctly!

### 2. Test Login
```bash
curl -X POST https://mealcartbackend.netlify.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser1@example.com","password":"password123"}'
```

### 3. Test AI Chat
```bash
# First get token
TOKEN=$(curl -s -X POST https://mealcartbackend.netlify.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser1@example.com","password":"password123"}' | jq -r '.data.token')

# Then test chat
curl -X POST https://mealcartbackend.netlify.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"Hello! Can you help me with cooking?"}'
```

---

## 📋 Checklist

Before testing your deployment:

- [ ] ✅ All environment variables added to Netlify
- [ ] ✅ GEMINI_API_KEY is valid and has quota remaining
- [ ] ✅ MONGODB_URI is correct (whitelist Netlify IPs or use 0.0.0.0/0)
- [ ] ✅ JWT_SECRET is set (same one used for existing users)
- [ ] ✅ Site redeployed after adding environment variables
- [ ] ✅ Health check shows all services configured
- [ ] ✅ No errors in Netlify function logs

---

## 🔍 Debugging

### View Netlify Function Logs
1. Go to Netlify dashboard
2. Click **Functions** tab
3. Click on **server** function
4. View real-time logs

### Common Issues

#### 1. "GEMINI_NOT_INITIALIZED"
**Problem:** GEMINI_API_KEY not set or invalid
**Solution:** 
- Add GEMINI_API_KEY to Netlify environment variables
- Verify key is valid at [Google AI Studio](https://aistudio.google.com/app/apikey)
- Redeploy site

#### 2. "Invalid or expired token"
**Problem:** JWT_SECRET mismatch or token expired
**Solution:**
- Ensure JWT_SECRET in Netlify matches local development
- If changed, users need to login again
- Check token expiry (default: 7 days)

#### 3. "Database connection error"
**Problem:** MongoDB URI not set or network access restricted
**Solution:**
- Add MONGODB_URI to Netlify environment variables
- In MongoDB Atlas:
  - Go to **Network Access**
  - Add `0.0.0.0/0` to allow all IPs (or specific Netlify IPs)
- Redeploy site

#### 4. Rate Limits
**Problem:** Too many AI requests
**Solution:**
- Check Gemini API quota at [Google AI Studio](https://aistudio.google.com)
- Upgrade to paid plan if needed
- Implement caching for common queries

---

## 🚀 Local vs Production

### Local (Docker)
```
http://localhost:5001
✅ Working
```

### Production (Netlify)
```
https://mealcartbackend.netlify.app
❌ Fix: Add environment variables
```

### What's Different?
| Feature | Local | Netlify |
|---------|-------|---------|
| Environment | `.env` file | Netlify dashboard |
| Port | 5001 | N/A (serverless) |
| Logs | Docker logs | Netlify function logs |
| Restart | `docker-compose restart` | Trigger deploy |

---

## 📝 Environment Variable Template

Create a `.env.production` file locally to keep track:

```bash
# AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/mealcart

# Frontend
FRONTEND_URL=https://meal-cart-phi.vercel.app

# Environment
NODE_ENV=production
PORT=5000
```

⚠️ **Never commit this file to Git!** Add it to `.gitignore`.

---

## 🔐 Security Notes

1. **API Keys:** Never expose in client-side code
2. **MongoDB:** Use strong passwords, restrict network access
3. **JWT Secret:** Use a strong random string (32+ characters)
4. **Environment Variables:** Different for each environment (dev/staging/production)
5. **CORS:** Configure allowed origins properly

---

## 📊 Monitoring

### Check Deployment Status
```bash
# Health check
curl https://mealcartbackend.netlify.app/api/health | jq

# Expected geminiConfigured: true
# Expected jwtConfigured: true
# Expected database: connected
```

### Monitor Function Logs
1. Netlify Dashboard → Functions → server
2. Watch for errors in real-time
3. Common log patterns:
   - `[AI] Gemini AI initialized successfully` ✅
   - `[DB] Connected to MongoDB successfully` ✅
   - `[GEMINI_API_KEY not set]` ❌ Fix this!

---

## ✅ Success Criteria

Your deployment is working when:

1. Health check shows all services configured
2. Login returns a valid JWT token
3. AI chat responds with cooking advice
4. No errors in Netlify function logs
5. Frontend can successfully call all endpoints

---

## 🆘 Still Having Issues?

1. Check Netlify function logs for specific errors
2. Verify all environment variables are set
3. Test health endpoint first
4. Ensure MongoDB allows Netlify connections
5. Verify Gemini API key has quota remaining

---

## 📞 Next Steps

After deployment is working:

1. ✅ Test all endpoints in Postman
2. ✅ Update frontend to use production URL
3. ✅ Monitor error rates
4. ✅ Set up error alerting
5. ✅ Configure rate limiting
6. ✅ Add caching for AI responses

---

**Remember:** Environment variables in Netlify are separate from your local `.env` file. You must set them manually in the Netlify dashboard!
