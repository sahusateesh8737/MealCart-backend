# 🔍 AI Search Recipes - 500 Error Diagnosis

## Error Details

```
POST https://mealcartbackend.netlify.app/api/ai/search-recipes 500 (Internal Server Error)
Error searching recipes: AxiosError {name: 'AxiosError', code: 'ERR_BAD_RESPONSE'}
```

---

## 🎯 Root Cause

**The `GEMINI_API_KEY` environment variable is NOT SET on Netlify production!**

### What's Happening:

1. **Frontend** calls: `POST /api/ai/search-recipes`
2. **Backend** tries to initialize Gemini AI
3. **Gemini AI** fails because `GEMINI_API_KEY` is missing
4. **Error Handler** returns 500 Internal Server Error

---

## 🔍 Code Flow

### In `routes/ai.js`:

```javascript
// At the top of the file (lines 10-21)
let genAI = null;
try {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AI] GEMINI_API_KEY not set - AI routes will return 503');
  } else {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('[AI] Gemini AI initialized successfully');
  }
} catch (error) {
  console.error('[AI] Failed to initialize Gemini AI:', error.message);
}

// In the endpoint (lines 565-577)
router.post('/search-recipes', async (req, res) => {
  try {
    // Check if Gemini AI is initialized
    if (!genAI) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED'
      });
    }
    
    // ... rest of the code
  } catch (error) {
    console.error('Error searching recipes with AI:', error);
    res.status(500).json({  // ← THIS IS WHAT'S RETURNING
      success: false,
      message: 'Error searching recipes with AI',
      error: error.message
    });
  }
});
```

---

## ✅ The Fix

### Step 1: Get Your Gemini API Key

1. Go to: https://aistudio.google.com/app/apikey
2. Click: **Get API Key** or **Create API Key**
3. Copy the key (starts with `AIza...`)

### Step 2: Add Environment Variable to Netlify

1. **Go to Netlify Dashboard**: https://app.netlify.com
2. **Select your site**: `mealcartbackend`
3. **Navigate to**: Site settings → Environment variables
4. **Click**: Add a variable
5. **Add**:
   - Key: `GEMINI_API_KEY`
   - Value: `AIza...` (paste your key)
   - Scopes: All environments
6. **Save**

### Step 3: Add ALL Required Environment Variables

While you're there, add these too (otherwise other features will fail):

| Variable | Value | Where to Get It |
|----------|-------|-----------------|
| `GEMINI_API_KEY` | `AIza...` | Google AI Studio |
| `JWT_SECRET` | (from .env) | Copy from your local `.env` file |
| `MONGODB_URI` | `mongodb+srv://...` | Copy from your local `.env` file |
| `NODE_ENV` | `production` | Just type it |
| `FRONTEND_URL` | `https://meal-cart-theta.vercel.app` | Your Vercel URL |

### Step 4: Redeploy

1. Go to: **Deploys** tab
2. Click: **Trigger deploy** → **Deploy site**
3. Wait 2-3 minutes for deployment

---

## 🧪 Test After Deployment

### Test the Health Check First:

```bash
curl https://mealcartbackend.netlify.app/api/health | jq '.'
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-04T...",
  "database": "connected",
  "platform": "Netlify Functions",
  "environment": "production",
  "geminiConfigured": true,  ← Should be TRUE
  "jwtConfigured": true      ← Should be TRUE
}
```

### Test AI Search:

```bash
curl -X POST https://mealcartbackend.netlify.app/api/ai/search-recipes \
  -H "Content-Type: application/json" \
  -d '{"query": "pasta"}' | jq '.'
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Classic Spaghetti Carbonara",
      "description": "...",
      "ingredients": [...],
      "instructions": [...],
      ...
    }
  ],
  "count": 5,
  "searchQuery": "pasta"
}
```

---

## 🚨 Why This Happened

### Local vs Production Environments

**Local (Works):**
- Reads from `.env` file ✅
- Has `GEMINI_API_KEY` ✅
- AI features work ✅

**Netlify (Fails):**
- Doesn't have `.env` file ❌
- Needs environment variables set in dashboard ❌
- AI features fail with 500 ❌

### The `.env` file is NOT deployed to Netlify!

Your `.env` file is in `.gitignore`, so it never gets pushed to GitHub or Netlify. This is **correct for security**, but you need to set the environment variables manually in the Netlify dashboard.

---

## 📋 Affected Endpoints

All of these will fail without `GEMINI_API_KEY`:

| Endpoint | Error | Fix |
|----------|-------|-----|
| `POST /api/ai/search-recipes` | 500 | Set GEMINI_API_KEY |
| `POST /api/ai/chat` | 500 | Set GEMINI_API_KEY |
| `POST /api/gemini/chat` | 500 | Set GEMINI_API_KEY |
| `POST /api/gemini/generate` | 500 | Set GEMINI_API_KEY |
| `POST /api/gemini/ask` | 500 | Set GEMINI_API_KEY |

---

## ✅ Summary

**Problem**: Missing `GEMINI_API_KEY` on Netlify

**Solution**: 
1. Get API key from Google AI Studio
2. Add to Netlify environment variables
3. Redeploy
4. Test

**Status**: 
- ✅ Local: Working
- ❌ Production: Needs env vars
- ⏳ Fix Time: 5 minutes

---

## 📞 Need Help?

If you're still getting errors after setting environment variables:

1. **Check Netlify Deploy Logs**
   - Go to: Deploys → Latest deploy → Function logs
   - Look for: `[AI] Gemini AI initialized successfully`

2. **Verify Environment Variables**
   - Go to: Site settings → Environment variables
   - Confirm all variables are set

3. **Check Function Logs**
   - Go to: Functions → server → Logs
   - Look for errors in real-time

---

**Next Steps**: Set the environment variables NOW to fix all AI features! 🚀
