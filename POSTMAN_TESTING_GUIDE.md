# 📮 Postman API Testing Guide - MealCart Backend

## 🚀 Quick Setup

### Base URL
```
http://localhost:5001/api
```

### Server Status
Check if server is running:
```bash
curl http://localhost:5001/health
```

---

## 🔐 Authentication APIs

### 1. Sign Up (Register)

**Endpoint:** `POST /api/auth/register`

**Request Body (JSON):**
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

**Headers:**
```
Content-Type: application/json
```

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "673abc123def456789",
    "username": "testuser",
    "email": "test@example.com",
    "createdAt": "2025-11-03T17:30:00.000Z"
  }
}
```

**Error Responses:**

*Missing Fields (400):*
```json
{
  "message": "All fields are required",
  "error": "MISSING_FIELDS"
}
```

*Password Too Short (400):*
```json
{
  "message": "Password must be at least 6 characters long",
  "error": "INVALID_PASSWORD"
}
```

*User Exists (400):*
```json
{
  "message": "User with this email already exists",
  "error": "USER_EXISTS"
}
```

---

### 2. Sign In (Login)

**Endpoint:** `POST /api/auth/login`

**Request Body (JSON):**
```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Headers:**
```
Content-Type: application/json
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "673abc123def456789",
    "username": "testuser",
    "email": "test@example.com",
    "lastLogin": "2025-11-03T17:35:00.000Z",
    "preferences": {
      "dietaryRestrictions": [],
      "favoriteRecipes": []
    }
  }
}
```

**Error Responses:**

*Missing Credentials (400):*
```json
{
  "message": "Email and password are required",
  "error": "MISSING_FIELDS"
}
```

*Invalid Credentials (401):*
```json
{
  "message": "Invalid email or password",
  "error": "INVALID_CREDENTIALS"
}
```

---

### 3. Get Current User (Verify Token)

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**Success Response (200):**
```json
{
  "user": {
    "id": "673abc123def456789",
    "username": "testuser",
    "email": "test@example.com",
    "createdAt": "2025-11-03T17:30:00.000Z",
    "lastLogin": "2025-11-03T17:35:00.000Z",
    "preferences": {
      "dietaryRestrictions": [],
      "favoriteRecipes": []
    }
  }
}
```

**Error Responses:**

*No Token (401):*
```json
{
  "message": "No token provided",
  "error": "UNAUTHORIZED"
}
```

*Invalid Token (401):*
```json
{
  "message": "Invalid token",
  "error": "INVALID_TOKEN"
}
```

*Token Expired (401):*
```json
{
  "message": "Token expired",
  "error": "TOKEN_EXPIRED"
}
```

---

## 🎯 Postman Setup Steps

### Step 1: Create a New Collection

1. Open Postman
2. Click "New" → "Collection"
3. Name it: "MealCart Backend"
4. Click "Create"

### Step 2: Add Sign Up Request

1. Click "Add request" in your collection
2. Name: "Sign Up"
3. Method: `POST`
4. URL: `http://localhost:5001/api/auth/register`
5. Go to "Body" tab
6. Select "raw" and "JSON"
7. Paste:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepass123"
}
```
8. Click "Send"

### Step 3: Add Sign In Request

1. Click "Add request" in your collection
2. Name: "Sign In"
3. Method: `POST`
4. URL: `http://localhost:5001/api/auth/login`
5. Go to "Body" tab
6. Select "raw" and "JSON"
7. Paste:
```json
{
  "email": "john@example.com",
  "password": "securepass123"
}
```
8. Click "Send"
9. Copy the `token` from response

### Step 4: Add Get Current User Request

1. Click "Add request"
2. Name: "Get Current User"
3. Method: `GET`
4. URL: `http://localhost:5001/api/auth/me`
5. Go to "Headers" tab
6. Add header:
   - Key: `Authorization`
   - Value: `Bearer YOUR_TOKEN_HERE` (paste the token from login)
7. Click "Send"

### Step 5: Setup Environment Variables (Optional)

1. Click "Environments" in left sidebar
2. Click "Create Environment"
3. Name: "Local Development"
4. Add variables:
   - `base_url` → `http://localhost:5001/api`
   - `token` → (leave empty, will be set automatically)
5. Save and select this environment

Now use `{{base_url}}` in your URLs:
```
{{base_url}}/auth/register
{{base_url}}/auth/login
```

### Step 6: Auto-Set Token (Advanced)

In your Sign In request, go to "Tests" tab and add:
```javascript
// Auto-save token to environment
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    pm.environment.set("token", jsonData.token);
    console.log("Token saved:", jsonData.token);
}
```

Then in "Get Current User" request, use:
```
Authorization: Bearer {{token}}
```

---

## 🧪 Test Scenarios

### Scenario 1: New User Registration
```bash
POST /api/auth/register
Body:
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "alice123"
}

Expected: 201 Created with token
```

### Scenario 2: Login with Valid Credentials
```bash
POST /api/auth/login
Body:
{
  "email": "alice@example.com",
  "password": "alice123"
}

Expected: 200 OK with token
```

### Scenario 3: Login with Invalid Password
```bash
POST /api/auth/login
Body:
{
  "email": "alice@example.com",
  "password": "wrongpassword"
}

Expected: 401 Unauthorized
```

### Scenario 4: Register with Existing Email
```bash
POST /api/auth/register
Body:
{
  "username": "alice2",
  "email": "alice@example.com",  // Already exists
  "password": "alice456"
}

Expected: 400 Bad Request - "User with this email already exists"
```

### Scenario 5: Register with Short Password
```bash
POST /api/auth/register
Body:
{
  "username": "bob",
  "email": "bob@example.com",
  "password": "123"  // Too short
}

Expected: 400 Bad Request - "Password must be at least 6 characters long"
```

### Scenario 6: Access Protected Route
```bash
GET /api/auth/me
Headers:
Authorization: Bearer YOUR_VALID_TOKEN

Expected: 200 OK with user data
```

### Scenario 7: Access Protected Route Without Token
```bash
GET /api/auth/me
(No Authorization header)

Expected: 401 Unauthorized
```

---

## 🔍 Testing Checklist

### Sign Up Tests
- [ ] Register with valid data → Success
- [ ] Register without username → Error
- [ ] Register without email → Error
- [ ] Register without password → Error
- [ ] Register with password < 6 chars → Error
- [ ] Register with duplicate email → Error
- [ ] Register with duplicate username → Error
- [ ] Verify token is returned
- [ ] Verify user data is returned

### Sign In Tests
- [ ] Login with valid credentials → Success
- [ ] Login without email → Error
- [ ] Login without password → Error
- [ ] Login with wrong email → Error
- [ ] Login with wrong password → Error
- [ ] Verify token is returned
- [ ] Verify lastLogin is updated

### Token Verification Tests
- [ ] Access /me with valid token → Success
- [ ] Access /me without token → Error
- [ ] Access /me with invalid token → Error
- [ ] Access /me with expired token → Error

---

## 📊 Expected Response Times

- Sign Up: < 1000ms
- Sign In: < 800ms
- Get Current User: < 300ms

---

## 🐛 Common Issues

### Issue: "Cannot POST /api/auth/register"
**Solution:** Make sure server is running on port 5001
```bash
docker-compose ps
# or
curl http://localhost:5001/health
```

### Issue: "ECONNREFUSED"
**Solution:** Start your server
```bash
docker-compose up -d
# or
npm run dev
```

### Issue: "User with this email already exists"
**Solution:** Use a different email or delete the existing user from database

### Issue: "Invalid token"
**Solution:** 
- Make sure token starts with "Bearer "
- Copy the full token from login response
- Token expires in 7 days, login again if expired

### Issue: CORS Error
**Solution:** Server has CORS configured for `https://meal-cart-phi.vercel.app`
For local testing via Postman, this shouldn't be an issue.

---

## 📥 Import Postman Collection

You can import this collection JSON:

```json
{
  "info": {
    "name": "MealCart Backend",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Sign Up",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"username\": \"testuser\",\n  \"email\": \"test@example.com\",\n  \"password\": \"password123\"\n}"
            },
            "url": {
              "raw": "http://localhost:5001/api/auth/register",
              "protocol": "http",
              "host": ["localhost"],
              "port": "5001",
              "path": ["api", "auth", "register"]
            }
          }
        },
        {
          "name": "Sign In",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"password123\"\n}"
            },
            "url": {
              "raw": "http://localhost:5001/api/auth/login",
              "protocol": "http",
              "host": ["localhost"],
              "port": "5001",
              "path": ["api", "auth", "login"]
            }
          },
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "if (pm.response.code === 200) {",
                  "    const jsonData = pm.response.json();",
                  "    pm.environment.set(\"token\", jsonData.token);",
                  "}"
                ]
              }
            }
          ]
        },
        {
          "name": "Get Current User",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{token}}"
              }
            ],
            "url": {
              "raw": "http://localhost:5001/api/auth/me",
              "protocol": "http",
              "host": ["localhost"],
              "port": "5001",
              "path": ["api", "auth", "me"]
            }
          }
        }
      ]
    }
  ]
}
```

Save this as `MealCart_Backend.postman_collection.json` and import in Postman.

---

## 🎓 Next Steps

1. **Test all auth endpoints** using the scenarios above
2. **Save the token** from login for protected routes
3. **Explore other APIs** (recipes, grocerylist, etc.)
4. **Create test data** using sign up
5. **Test error cases** to ensure proper validation

---

**Need help?** Check server logs:
```bash
docker-compose logs -f app
```
