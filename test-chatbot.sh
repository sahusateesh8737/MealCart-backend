
#!/bin/bash

# MealCart AI Chatbot Test Script

echo "🤖 Testing MealCart AI Chatbot"
echo "================================"
echo ""

# Step 1: Login and get token
echo "Step 1: Getting authentication token..."
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser1@example.com","password":"password123"}' | jq -r '.token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get token. Please check credentials."
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}..."
echo ""

# Step 2: Test chatbot with a simple question
echo "Step 2: Testing chatbot with a simple question..."
echo "Question: 'How do I make perfect scrambled eggs?'"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:5001/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "How do I make perfect scrambled eggs?"
  }')

echo "Response:"
echo "$RESPONSE" | jq -r '.response' || echo "$RESPONSE"
echo ""

# Step 3: Test with conversation history
echo "Step 3: Testing follow-up question with conversation history..."
echo "Question: 'Can I make them without milk?'"
echo ""

RESPONSE2=$(curl -s -X POST http://localhost:5001/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"message\": \"Can I make them without milk?\",
    \"conversationHistory\": [
      {
        \"role\": \"user\",
        \"content\": \"How do I make perfect scrambled eggs?\"
      },
      {
        \"role\": \"assistant\",
        \"content\": \"To make perfect scrambled eggs, beat eggs with milk and cook on low heat.\"
      }
    ],
    \"conversationId\": \"conv_test_123\"
  }")

echo "Response:"
echo "$RESPONSE2" | jq -r '.response' || echo "$RESPONSE2"
echo ""

echo "✅ Chatbot test completed!"
echo ""
echo "📝 To test in Postman:"
echo "   1. POST to: http://localhost:5001/api/gemini/chat"
echo "   2. Add Header: Authorization: Bearer $TOKEN"
echo "   3. Send JSON body with 'message' field"
echo ""
