#!/bin/bash

# Test script for pantry endpoints

echo "🥫 Testing Pantry API Endpoints"
echo "================================"
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

# Wait for server to be fully ready
sleep 3

# Test 1: Get empty pantry
echo "2️⃣  Testing GET /api/users/pantry..."
curl -s -X GET http://localhost:5001/api/users/pantry \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 2: Add vegetables category item
echo "3️⃣  Testing POST /api/users/pantry (Add carrots - vegetables category)..."
RESPONSE=$(curl -s -X POST http://localhost:5001/api/users/pantry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Carrots",
    "amount": 5,
    "unit": "lbs",
    "category": "vegetables",
    "expirationDate": "2025-11-10"
  }')
echo "$RESPONSE" | jq '.'
ITEM_ID=$(echo "$RESPONSE" | jq -r '.data._id')
echo ""

# Test 3: Add produce category item
echo "4️⃣  Testing POST /api/users/pantry (Add apples - produce category)..."
curl -s -X POST http://localhost:5001/api/users/pantry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Apples",
    "amount": 10,
    "unit": "count",
    "category": "produce",
    "expirationDate": "2025-11-15"
  }' | jq '.'
echo ""

# Test 4: Add dairy item
echo "5️⃣  Testing POST /api/users/pantry (Add milk - dairy category)..."
curl -s -X POST http://localhost:5001/api/users/pantry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Milk",
    "amount": 2,
    "unit": "gallon",
    "category": "dairy",
    "expirationDate": "2025-11-08"
  }' | jq '.'
echo ""

# Test 5: Add meat item
echo "6️⃣  Testing POST /api/users/pantry (Add chicken - meat category)..."
curl -s -X POST http://localhost:5001/api/users/pantry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Chicken Breast",
    "amount": 3,
    "unit": "lbs",
    "category": "meat",
    "expirationDate": "2025-11-06"
  }' | jq '.'
echo ""

# Test 6: Add frozen item
echo "7️⃣  Testing POST /api/users/pantry (Add frozen peas - frozen category)..."
curl -s -X POST http://localhost:5001/api/users/pantry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Frozen Peas",
    "amount": 2,
    "unit": "bags",
    "category": "frozen"
  }' | jq '.'
echo ""

# Test 7: Add pantry item
echo "8️⃣  Testing POST /api/users/pantry (Add rice - pantry category)..."
curl -s -X POST http://localhost:5001/api/users/pantry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "White Rice",
    "amount": 5,
    "unit": "lbs",
    "category": "pantry"
  }' | jq '.'
echo ""

# Test 8: Get pantry with items (sorted by expiration)
echo "9️⃣  Testing GET /api/users/pantry (should have 6 items, sorted)..."
curl -s -X GET http://localhost:5001/api/users/pantry \
  -H "Authorization: Bearer $TOKEN" | jq '.data | map({name: .name, category: .category, expires: .expirationDate})'
echo ""

# Test 9: Update item
if [ ! -z "$ITEM_ID" ] && [ "$ITEM_ID" != "null" ]; then
  echo "🔟  Testing PUT /api/users/pantry/$ITEM_ID (update carrots amount)..."
  curl -s -X PUT http://localhost:5001/api/users/pantry/$ITEM_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"amount": 3}' | jq '.'
  echo ""
fi

# Test 10: Delete item
if [ ! -z "$ITEM_ID" ] && [ "$ITEM_ID" != "null" ]; then
  echo "1️⃣1️⃣  Testing DELETE /api/users/pantry/$ITEM_ID (delete carrots)..."
  curl -s -X DELETE http://localhost:5001/api/users/pantry/$ITEM_ID \
    -H "Authorization: Bearer $TOKEN" | jq '.'
  echo ""
fi

# Test 11: Final pantry check
echo "1️⃣2️⃣  Testing GET /api/users/pantry (should have 5 items)..."
curl -s -X GET http://localhost:5001/api/users/pantry \
  -H "Authorization: Bearer $TOKEN" | jq '.success, (.data | length)'
echo ""

echo "✅ All pantry tests complete!"
echo ""
echo "================================"
echo "📋 Available Endpoints:"
echo "  GET    /api/users/pantry         - Get user's pantry items"
echo "  POST   /api/users/pantry         - Add item to pantry"
echo "  PUT    /api/users/pantry/:id     - Update pantry item"
echo "  DELETE /api/users/pantry/:id     - Delete pantry item"
echo "================================"
echo ""
echo "✅ Accepted Categories:"
echo "  - vegetables, produce, fruits"
echo "  - dairy, cheese"
echo "  - meat, poultry, seafood"
echo "  - frozen"
echo "  - pantry, grains, spices"
echo "  - Any other custom category!"
