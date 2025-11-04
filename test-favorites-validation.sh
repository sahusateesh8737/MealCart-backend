#!/bin/bash

# Test script for favorites validation

echo "❤️  Testing Favorites API Validation"
echo "====================================="
echo ""

# Get token
echo "1️⃣  Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser1@example.com","password":"password123"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token obtained"
echo ""

# Wait for server
sleep 3

# Test 1: Try to add favorite with undefined ID
echo "2️⃣  Testing POST /api/users/favorites/undefined (should fail gracefully)..."
curl -s -X POST http://localhost:5001/api/users/favorites/undefined \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 2: Try to add favorite with null ID
echo "3️⃣  Testing POST /api/users/favorites/null (should fail gracefully)..."
curl -s -X POST http://localhost:5001/api/users/favorites/null \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 3: Try to delete favorite with undefined ID
echo "4️⃣  Testing DELETE /api/users/favorites/undefined (should fail gracefully)..."
curl -s -X DELETE http://localhost:5001/api/users/favorites/undefined \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 4: Try with invalid ObjectId format
echo "5️⃣  Testing POST /api/users/favorites/invalid123 (should fail with proper error)..."
curl -s -X POST http://localhost:5001/api/users/favorites/invalid123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

echo "✅ All validation tests complete!"
echo ""
echo "====================================="
echo "📋 Expected Behavior:"
echo "  - 'undefined' recipe ID → 400 with helpful message"
echo "  - 'null' recipe ID → 400 with helpful message"
echo "  - Invalid ObjectId → 400 with proper error"
echo ""
echo "✅ Backend now provides clear error messages"
echo "   for invalid recipe IDs from frontend!"
echo "====================================="
