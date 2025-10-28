# Mobile Device Testing Guide

## 🔍 Debugging "No Recipes" Issue on Mobile

### Issue: Frontend shows "No recipes" on mobile but works on desktop

---

## ✅ Backend Changes Applied:

1. **New Simpler Endpoint**: `/api/recipes/my-recipes`
   - No need to pass userId in URL
   - Automatically uses authenticated user
   - Better for mobile apps

2. **Enhanced CORS for Mobile**:
   - Supports requests with no origin header (native mobile apps)
   - Supports local network IPs (192.168.x.x)
   - Better logging for debugging

3. **Better Response Format**:
   - All responses now include `success: true/false`
   - Consistent error handling

---

## 🧪 Testing on Mobile:

### Option 1: Use New Endpoint (RECOMMENDED)

**Endpoint:**
```
GET https://mealcartbackend.netlify.app/api/recipes/my-recipes
```

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**No userId needed in URL!** Much simpler for frontend.

**Response:**
```json
{
  "success": true,
  "count": 5,
  "recipes": [...],
  "userId": "672f1234567890abcdef"
}
```

---

### Option 2: Use Existing Endpoint

**Endpoint:**
```
GET https://mealcartbackend.netlify.app/api/recipes/saved/{userId}
```

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Response:**
```json
{
  "success": true,
  "recipes": [...],
  "pagination": {...}
}
```

---

## 🐛 Common Mobile Issues & Fixes:

### Issue 1: "No recipes found" but recipes exist

**Possible Causes:**
1. ❌ Token expired (tokens last 7 days)
2. ❌ userId in URL doesn't match token
3. ❌ Frontend not sending Authorization header
4. ❌ Network request failing silently

**Fix:**
- Use the new `/api/recipes/my-recipes` endpoint
- Check browser console / network tab for errors
- Re-login to get fresh token

---

### Issue 2: CORS errors on mobile

**Symptoms:**
```
Access to fetch at '...' from origin 'null' has been blocked by CORS
```

**Fix:**
✅ Already fixed! Backend now allows:
- Requests with no origin (mobile browsers)
- localhost and 192.168.x.x (local testing)
- All Vercel domains

---

### Issue 3: Frontend making wrong API call

**Check these in your frontend code:**

```javascript
// ❌ WRONG - Missing Authorization header
fetch('https://mealcartbackend.netlify.app/api/recipes/saved/123')

// ✅ CORRECT - With Authorization
fetch('https://mealcartbackend.netlify.app/api/recipes/my-recipes', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
```

---

## 📱 Frontend Code Example:

```javascript
// Get saved recipes on mobile
const fetchRecipes = async () => {
  try {
    const token = localStorage.getItem('token'); // or AsyncStorage on React Native
    
    if (!token) {
      console.error('No token found - user not logged in');
      return;
    }

    const response = await fetch(
      'https://mealcartbackend.netlify.app/api/recipes/my-recipes',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error('API Error:', data);
      if (response.status === 401) {
        // Token expired or invalid - redirect to login
        console.log('Token expired - please login again');
      }
      return;
    }

    if (data.success && data.recipes) {
      console.log(`Found ${data.count} recipes`);
      // Update UI with recipes
      setRecipes(data.recipes);
    } else {
      console.log('No recipes found');
      setRecipes([]);
    }

  } catch (error) {
    console.error('Network error:', error);
    // Handle network errors
  }
};
```

---

## 🔧 Quick Debugging Steps:

1. **Open mobile browser DevTools** (if using Chrome on mobile)
2. **Check Network tab** - Is the request being made?
3. **Check Console** - Any JavaScript errors?
4. **Verify token exists** - `console.log(localStorage.getItem('token'))`
5. **Check response** - What does the API return?

---

## 📊 Backend Logs to Check:

After deploying, check Netlify Function logs for:
```
[CORS] Request origin: ...
[My Recipes] Request from user: ...
[My Recipes] Found recipes: 5
```

If you see `Found recipes: 0` but you know recipes exist, the issue is:
- Wrong userId
- Token belongs to different user
- Database issue

---

## 🎯 Action Items for Frontend:

1. **Switch to new endpoint**: `/api/recipes/my-recipes`
2. **Always send Authorization header**: `Bearer ${token}`
3. **Check for `success` field** in response
4. **Handle errors properly**:
   - 401 → Redirect to login
   - 403 → Show "Access denied"
   - 500 → Show "Server error"
5. **Add loading states** while fetching

---

## 🚀 Testing Checklist:

- [ ] Login on mobile and save token
- [ ] Call `/api/recipes/my-recipes` with token
- [ ] Check Network tab for request/response
- [ ] Verify Authorization header is sent
- [ ] Check if `success: true` and `count > 0`
- [ ] If count is 0, save a test recipe first
- [ ] Re-test after saving a recipe

---

## 📞 Still Having Issues?

Check these:
1. Is user actually logged in?
2. Does the user have any saved recipes in DB?
3. Is the token valid (not expired)?
4. Is the API URL correct?
5. Is the frontend sending the right headers?

The backend is now ready and optimized for mobile! 🎉
