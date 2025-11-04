#!/bin/bash

# Test script for grocery list endpoints

echo "🛒 Testing Grocery List API Endpoints"
echo "======================================"
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

# Test 1: Get empty grocery list
echo "2️⃣  Testing GET /api/grocerylist..."
curl -s -X GET http://localhost:5001/api/grocerylist \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 2: Add item to grocery list
echo "3️⃣  Testing POST /api/grocerylist/item (Add tomatoes)..."
RESPONSE=$(curl -s -X POST http://localhost:5001/api/grocerylist/item \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Tomatoes",
    "amount": "2",
    "unit": "lbs",
    "category": "Produce"
  }')
echo "$RESPONSE" | jq '.'
ITEM_ID=$(echo "$RESPONSE" | jq -r '.item._id')
echo ""

# Test 3: Add another item
echo "4️⃣  Testing POST /api/grocerylist/item (Add milk)..."
curl -s -X POST http://localhost:5001/api/grocerylist/item \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Milk",
    "amount": "1",
    "unit": "gallon",
    "category": "Dairy & Eggs"
  }' | jq '.'
echo ""

# Test 4: Get grocery list with items
echo "5️⃣  Testing GET /api/grocerylist (should have 2 items)..."
curl -s -X GET http://localhost:5001/api/grocerylist \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 5: Update item (check it off)
if [ ! -z "$ITEM_ID" ] && [ "$ITEM_ID" != "null" ]; then
  echo "6️⃣  Testing PUT /api/grocerylist/item/$ITEM_ID (mark as checked)..."
  curl -s -X PUT http://localhost:5001/api/grocerylist/item/$ITEM_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"checked": true}' | jq '.'
  echo ""
fi

# Test 6: Clear checked items
echo "7️⃣  Testing DELETE /api/grocerylist/checked (remove checked items)..."
curl -s -X DELETE http://localhost:5001/api/grocerylist/checked \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 7: Get final list
echo "8️⃣  Testing GET /api/grocerylist (should have 1 item)..."
curl -s -X GET http://localhost:5001/api/grocerylist \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 8: Clear all
echo "9️⃣  Testing DELETE /api/grocerylist/clear (clear all items)..."
curl -s -X DELETE http://localhost:5001/api/grocerylist/clear \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

echo "✅ All tests complete!"
echo ""
echo "======================================"
echo "📋 Available Endpoints:"
echo "  GET    /api/grocerylist           - Get user's grocery list"
echo "  POST   /api/grocerylist/item      - Add item to list"
echo "  PUT    /api/grocerylist/item/:id  - Update item"
echo "  DELETE /api/grocerylist/item/:id  - Delete item"
echo "  DELETE /api/grocerylist/checked   - Remove all checked items"
echo "  DELETE /api/grocerylist/clear     - Clear entire list"
echo "======================================"
