#!/bin/bash

# Quick test script for /api/ai/chat endpoint

echo "Testing /api/ai/chat endpoint..."
echo ""

# Get token
echo "1. Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser1@example.com","password":"password123"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token obtained"
echo ""

# Test /api/ai/chat
echo "2. Testing /api/ai/chat endpoint..."
echo "Message: 'Hello! Can you help me with cooking?'"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:5001/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message":"Hello! Can you help me with cooking?"}')

SUCCESS=$(echo "$RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
  echo "✅ Endpoint working!"
  echo ""
  echo "Response:"
  echo "$RESPONSE" | jq -r '.response'
else
  echo "❌ Endpoint failed"
  echo "$RESPONSE" | jq '.'
fi

echo ""
echo "✅ Test complete!"
echo ""
echo "Your frontend can now use: POST https://mealcartbackend.netlify.app/api/ai/chat"
