#!/bin/bash

# Netlify Deployment Diagnostic Script
# Checks if your Netlify deployment is properly configured

NETLIFY_URL="https://mealcartbackend.netlify.app"

echo "🔍 MealCart Backend - Netlify Deployment Diagnostic"
echo "=================================================="
echo ""

# Test 1: Check if site is accessible
echo "1️⃣  Testing site accessibility..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$NETLIFY_URL")
if [ "$STATUS" = "200" ]; then
  echo "✅ Site is accessible (Status: $STATUS)"
else
  echo "❌ Site returned status: $STATUS"
fi
echo ""

# Test 2: Check health endpoint
echo "2️⃣  Checking health endpoint..."
HEALTH=$(curl -s "$NETLIFY_URL/api/health")
echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"

# Check specific flags
GEMINI=$(echo "$HEALTH" | jq -r '.geminiConfigured' 2>/dev/null)
JWT=$(echo "$HEALTH" | jq -r '.jwtConfigured' 2>/dev/null)
DB=$(echo "$HEALTH" | jq -r '.database' 2>/dev/null)

echo ""
echo "📊 Configuration Status:"
echo "   Gemini API: $([ "$GEMINI" = "true" ] && echo "✅ Configured" || echo "❌ NOT CONFIGURED")"
echo "   JWT Secret: $([ "$JWT" = "true" ] && echo "✅ Configured" || echo "❌ NOT CONFIGURED")"
echo "   Database:   $([ "$DB" = "connected" ] && echo "✅ Connected" || echo "❌ NOT CONNECTED")"
echo ""

# Test 3: Check if AI routes exist
echo "3️⃣  Checking AI chat route..."
AI_ROUTE=$(curl -s -o /dev/null -w "%{http_code}" "$NETLIFY_URL/api/ai/chat")
if [ "$AI_ROUTE" = "401" ]; then
  echo "✅ Route exists (requires authentication)"
elif [ "$AI_ROUTE" = "200" ] || [ "$AI_ROUTE" = "400" ]; then
  echo "✅ Route exists"
else
  echo "❌ Route not found or error (Status: $AI_ROUTE)"
fi
echo ""

# Test 4: Test login endpoint
echo "4️⃣  Testing authentication..."
LOGIN=$(curl -s -X POST "$NETLIFY_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser1@example.com","password":"password123"}')

LOGIN_SUCCESS=$(echo "$LOGIN" | jq -r '.success' 2>/dev/null)
if [ "$LOGIN_SUCCESS" = "true" ]; then
  echo "✅ Authentication working"
  TOKEN=$(echo "$LOGIN" | jq -r '.data.token' 2>/dev/null)
  echo "   Token obtained: ${TOKEN:0:30}..."
else
  echo "❌ Authentication failed"
  echo "$LOGIN" | jq '.' 2>/dev/null || echo "$LOGIN"
fi
echo ""

# Test 5: Test AI chat (if we have token)
if [ ! -z "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "5️⃣  Testing AI chat endpoint..."
  CHAT=$(curl -s -X POST "$NETLIFY_URL/api/ai/chat" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"message":"Hello"}')
  
  CHAT_SUCCESS=$(echo "$CHAT" | jq -r '.success' 2>/dev/null)
  if [ "$CHAT_SUCCESS" = "true" ]; then
    echo "✅ AI chat working!"
    RESPONSE=$(echo "$CHAT" | jq -r '.response' 2>/dev/null)
    echo "   Response: ${RESPONSE:0:100}..."
  else
    echo "❌ AI chat failed"
    echo "$CHAT" | jq '.' 2>/dev/null || echo "$CHAT"
  fi
else
  echo "5️⃣  Skipping AI chat test (no valid token)"
fi

echo ""
echo "=================================================="
echo "📋 Summary"
echo "=================================================="
echo ""

# Overall status
if [ "$GEMINI" = "true" ] && [ "$JWT" = "true" ] && [ "$DB" = "connected" ] && [ "$LOGIN_SUCCESS" = "true" ] && [ "$CHAT_SUCCESS" = "true" ]; then
  echo "🎉 ALL SYSTEMS OPERATIONAL!"
  echo ""
  echo "Your Netlify deployment is fully functional."
  echo "You can now use: $NETLIFY_URL/api/ai/chat"
elif [ "$GEMINI" != "true" ] || [ "$JWT" != "true" ]; then
  echo "⚠️  ENVIRONMENT VARIABLES MISSING"
  echo ""
  echo "Action Required:"
  echo "1. Go to https://app.netlify.com"
  echo "2. Select your site: mealcartbackend"
  echo "3. Go to Site settings → Environment variables"
  echo "4. Add the missing variables:"
  [ "$GEMINI" != "true" ] && echo "   - GEMINI_API_KEY (from Google AI Studio)"
  [ "$JWT" != "true" ] && echo "   - JWT_SECRET (a secure random string)"
  [ "$DB" != "connected" ] && echo "   - MONGODB_URI (your MongoDB connection string)"
  echo "5. Trigger a new deploy"
  echo ""
  echo "📖 Read NETLIFY_DEPLOYMENT.md for detailed instructions"
else
  echo "❌ DEPLOYMENT HAS ISSUES"
  echo ""
  echo "Check the errors above and:"
  echo "1. Verify environment variables in Netlify dashboard"
  echo "2. Check MongoDB network access allows Netlify"
  echo "3. Verify Gemini API key is valid and has quota"
  echo "4. View Netlify function logs for detailed errors"
  echo ""
  echo "📖 Read NETLIFY_DEPLOYMENT.md for troubleshooting"
fi

echo ""
