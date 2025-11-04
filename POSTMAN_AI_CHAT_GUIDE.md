# Postman Testing Guide - AI Chat Endpoint

## Overview
This guide will help you test the `/api/ai/chat` endpoint in Postman.

## Base URL
```
http://localhost:5001
```

---

## Step 1: Get Authentication Token

### Request Details
- **Method**: `POST`
- **URL**: `http://localhost:5001/api/auth/login`
- **Headers**:
  ```
  Content-Type: application/json
  ```
- **Body** (raw JSON):
  ```json
  {
    "email": "testuser1@example.com",
    "password": "password123"
  }
  ```

### Expected Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "name": "Test User",
      "email": "testuser1@example.com"
    }
  }
}
```

**📝 Important**: Copy the `token` value from the response. You'll need it for the next request.

---

## Step 2: Test AI Chat (Basic Message)

### Request Details
- **Method**: `POST`
- **URL**: `http://localhost:5001/api/ai/chat`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN_HERE
  ```
  ⚠️ Replace `YOUR_TOKEN_HERE` with the token from Step 1

- **Body** (raw JSON):
  ```json
  {
    "message": "Hello! Can you help me with cooking?"
  }
  ```

### Expected Response
```json
{
  "success": true,
  "response": "Of course, I'd love to help you with cooking! What are you hoping to cook today, or what kind of cooking help are you looking for?...",
  "conversationId": "conv_1762234815515",
  "timestamp": "2025-11-04T05:24:37.802Z"
}
```

---

## Step 3: Test AI Chat (With Conversation History)

### Request Details
- **Method**: `POST`
- **URL**: `http://localhost:5001/api/ai/chat`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN_HERE
  ```

- **Body** (raw JSON):
  ```json
  {
    "message": "What did I just ask you about?",
    "conversationHistory": [
      {
        "role": "user",
        "content": "Hello! Can you help me with cooking?"
      },
      {
        "role": "assistant",
        "content": "Of course! I would love to help you with cooking!"
      }
    ]
  }
  ```

### Expected Response
```json
{
  "success": true,
  "response": "You just asked me if I could help you with cooking! I can definitely help you with that...",
  "conversationId": "conv_1762234815515",
  "timestamp": "2025-11-04T05:24:37.802Z"
}
```

---

## Step 4: Test Recipe Request

### Request Details
- **Method**: `POST`
- **URL**: `http://localhost:5001/api/ai/chat`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN_HERE
  ```

- **Body** (raw JSON):
  ```json
  {
    "message": "Can you suggest a quick pasta recipe?"
  }
  ```

### Expected Response
The AI will provide a detailed pasta recipe with ingredients and instructions.

---

## Step 5: Test with Dietary Restrictions

### Request Details
- **Method**: `POST`
- **URL**: `http://localhost:5001/api/ai/chat`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer YOUR_TOKEN_HERE
  ```

- **Body** (raw JSON):
  ```json
  {
    "message": "I'm vegan and gluten-free. What can I cook for dinner?",
    "conversationHistory": [
      {
        "role": "user",
        "content": "Can you suggest a quick pasta recipe?"
      },
      {
        "role": "assistant",
        "content": "Here's a quick pasta recipe..."
      }
    ]
  }
  ```

---

## Common Error Responses

### 1. Missing Authorization Token
**Status**: `401 Unauthorized`
```json
{
  "success": false,
  "error": {
    "message": "No token provided",
    "code": "NO_TOKEN"
  }
}
```

### 2. Invalid Token
**Status**: `401 Unauthorized`
```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired token",
    "code": "INVALID_TOKEN"
  }
}
```

### 3. Missing Message
**Status**: `400 Bad Request`
```json
{
  "success": false,
  "error": {
    "message": "Message is required",
    "code": "VALIDATION_ERROR"
  }
}
```

### 4. Gemini API Quota Exceeded
**Status**: `429 Too Many Requests`
```json
{
  "success": false,
  "error": {
    "message": "Gemini API quota exceeded. Please try again later.",
    "code": "QUOTA_EXCEEDED"
  }
}
```

---

## Postman Collection JSON

You can import this collection into Postman:

```json
{
  "info": {
    "name": "MealCart AI Chat API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "1. Login",
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
          "raw": "{\n  \"email\": \"testuser1@example.com\",\n  \"password\": \"password123\"\n}"
        },
        "url": {
          "raw": "http://localhost:5001/api/auth/login",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5001",
          "path": ["api", "auth", "login"]
        }
      }
    },
    {
      "name": "2. AI Chat - Basic",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"message\": \"Hello! Can you help me with cooking?\"\n}"
        },
        "url": {
          "raw": "http://localhost:5001/api/ai/chat",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5001",
          "path": ["api", "ai", "chat"]
        }
      }
    },
    {
      "name": "3. AI Chat - With History",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"message\": \"What did I just ask you about?\",\n  \"conversationHistory\": [\n    {\n      \"role\": \"user\",\n      \"content\": \"Hello! Can you help me with cooking?\"\n    },\n    {\n      \"role\": \"assistant\",\n      \"content\": \"Of course! I would love to help you with cooking!\"\n    }\n  ]\n}"
        },
        "url": {
          "raw": "http://localhost:5001/api/ai/chat",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5001",
          "path": ["api", "ai", "chat"]
        }
      }
    }
  ]
}
```

---

## Quick Setup in Postman

### Option 1: Manual Setup
1. Open Postman
2. Create a new request
3. Set method to `POST`
4. Enter URL: `http://localhost:5001/api/auth/login`
5. Go to "Body" tab → Select "raw" → Select "JSON"
6. Paste the login body
7. Click "Send"
8. Copy the token from response
9. Create another request for `/api/ai/chat`
10. Add Authorization header with the token
11. Paste the chat body
12. Click "Send"

### Option 2: Import Collection
1. Open Postman
2. Click "Import" button
3. Copy the JSON collection above
4. Paste and import
5. Create an environment variable `{{token}}` or replace manually

---

## Testing Tips

1. **Save the token**: After logging in, save the token to a Postman environment variable for easy reuse
2. **Test conversation flow**: Try sending multiple messages with conversation history to see context awareness
3. **Test error cases**: Try requests without token, with invalid token, without message field
4. **Check response times**: AI responses may take 2-5 seconds depending on complexity
5. **Monitor rate limits**: You're limited to 100 requests per 15 minutes

---

## Environment Variables for Postman

Create these variables in Postman environment:

| Variable | Initial Value | Current Value |
|----------|--------------|---------------|
| `base_url` | `http://localhost:5001` | |
| `token` | | (will be set after login) |
| `email` | `testuser1@example.com` | |
| `password` | `password123` | |

Then use `{{base_url}}`, `{{token}}`, etc. in your requests.

---

## Need Help?

- Check Docker logs: `docker-compose logs app`
- Verify server is running: `http://localhost:5001/health`
- Check authentication: Make sure you're using the correct token
- Token expiry: Tokens expire after 7 days, login again if expired

---

## Next Steps

Once you've tested in Postman:
1. ✅ Basic chat working
2. ✅ Conversation history working
3. ✅ Error handling verified
4. 🚀 Ready to integrate with frontend!

Your Netlify frontend can now call this endpoint at your production backend URL.
