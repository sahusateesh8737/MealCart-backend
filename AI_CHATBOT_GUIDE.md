# 🤖 AI Chatbot API Guide - MealCart Backend

## Overview

The AI Chatbot provides a conversational interface for cooking and recipe assistance powered by Google's Gemini AI. Users can ask questions about recipes, cooking techniques, ingredients, meal planning, and more.

---

## 🎯 Chatbot Endpoint

### POST `/api/gemini/chat`

**Description:** Send a message to the AI cooking assistant and get a conversational response.

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "message": "How do I make perfect scrambled eggs?",
  "conversationHistory": [
    {
      "role": "user",
      "content": "What's for breakfast?"
    },
    {
      "role": "assistant",
      "content": "There are many great breakfast options! What ingredients do you have?"
    }
  ],
  "conversationId": "conv_1730659200000"
}
```

**Parameters:**
- `message` (string, required): The user's current message
- `conversationHistory` (array, optional): Previous messages for context (last 5 messages used)
- `conversationId` (string, optional): ID to track the conversation

**Success Response (200):**
```json
{
  "success": true,
  "message": "Response generated successfully",
  "response": "To make perfect scrambled eggs, here's what you need to do:\n\n1. **Beat the eggs well**: Whisk 2-3 eggs with a splash of milk or cream\n2. **Low heat is key**: Use medium-low heat with butter\n3. **Slow and gentle**: Stir continuously in a figure-8 motion\n4. **Remove before done**: Take off heat when eggs are still slightly wet\n5. **Season at the end**: Add salt and pepper after cooking\n\nThe key is patience - cook them slowly for creamy, fluffy results!",
  "conversationId": "conv_1730659200000",
  "timestamp": "2025-11-03T18:00:00.000Z"
}
```

**Error Responses:**

*Missing Message (400):*
```json
{
  "message": "Message is required and must be a non-empty string",
  "error": "MISSING_MESSAGE"
}
```

*Invalid API Key (401):*
```json
{
  "message": "Invalid or expired API key",
  "error": "INVALID_API_KEY"
}
```

*Quota Exceeded (429):*
```json
{
  "message": "API quota exceeded. Please try again later.",
  "error": "QUOTA_EXCEEDED"
}
```

*Content Filtered (400):*
```json
{
  "message": "Content filtered for safety reasons",
  "error": "CONTENT_FILTERED"
}
```

---

## 💡 Chatbot Capabilities

The AI assistant can help with:

### 🍳 Cooking Techniques
- "How do I make fluffy pancakes?"
- "What's the best way to cook chicken breast?"
- "How do I properly season a cast iron skillet?"

### 🥗 Recipe Recommendations
- "What can I make with chicken, rice, and broccoli?"
- "Give me a healthy dinner recipe for 4 people"
- "I need a quick lunch idea under 30 minutes"

### 🔄 Ingredient Substitutions
- "What can I use instead of eggs in baking?"
- "Substitute for heavy cream?"
- "Dairy-free butter alternatives?"

### 📊 Nutritional Advice
- "How many calories in a chicken Caesar salad?"
- "What are good high-protein snacks?"
- "Is olive oil healthier than butter?"

### 🛒 Meal Planning
- "Help me plan meals for a week"
- "Budget-friendly dinner ideas?"
- "Meal prep recipes for busy weekdays"

### 🍽️ Dietary Restrictions
- "Gluten-free pasta alternatives?"
- "Vegan protein sources"
- "Low-carb breakfast ideas"

### 🧊 Food Storage & Safety
- "How long does cooked chicken last in the fridge?"
- "Can I freeze leftover soup?"
- "How to tell if eggs are fresh?"

---

## 🚀 Postman Setup

### 1. Create Chat Request

**Method:** `POST`

**URL:** `http://localhost:5001/api/gemini/chat`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

**Body (JSON):**
```json
{
  "message": "What's the secret to perfect pasta?"
}
```

### 2. With Conversation History

**Body (JSON):**
```json
{
  "message": "How long should I cook it?",
  "conversationHistory": [
    {
      "role": "user",
      "content": "What's the secret to perfect pasta?"
    },
    {
      "role": "assistant",
      "content": "Perfect pasta requires: 1) Lots of salted boiling water, 2) Don't overcook - aim for al dente, 3) Save pasta water for sauce, 4) Toss pasta with sauce in the pan."
    }
  ],
  "conversationId": "conv_1730659200000"
}
```

---

## 📝 Example Conversations

### Example 1: Quick Recipe Help

**User:** "I have eggs, bread, and cheese. What can I make?"

**Assistant:** "You can make several delicious dishes with those ingredients:

1. **Classic Grilled Cheese** - Simple and satisfying
2. **French Toast** - Sweet breakfast option with eggs and bread
3. **Cheese Omelet** - Fluffy eggs with melted cheese
4. **Egg & Cheese Sandwich** - Quick breakfast sandwich
5. **Bread Pudding** - If you want something dessert-like

Which sounds most appealing? I can provide detailed instructions for any of these!"

---

### Example 2: Cooking Technique

**User:** "My chicken always comes out dry. Help!"

**Assistant:** "Dry chicken is a common problem! Here's how to keep it juicy:

**Prevention Tips:**
- Don't overcook - use a thermometer (165°F/74°C)
- Brine chicken before cooking (30 mins in salt water)
- Don't skip the rest period (5-10 minutes after cooking)

**Cooking Methods:**
- **Pan:** Cook on medium heat with a lid
- **Oven:** Bake at 375°F, not higher
- **Grill:** Use indirect heat and flip once

**Secret weapon:** Brush with butter or oil while cooking!

Which cooking method do you usually use?"

---

### Example 3: Meal Planning

**User:** "Help me plan healthy dinners for this week"

**Assistant:** "I'd love to help! Let me create a balanced weekly plan:

**Monday:** Grilled Chicken with Roasted Vegetables
**Tuesday:** Baked Salmon with Quinoa and Steamed Broccoli  
**Wednesday:** Turkey Chili with Mixed Bean Salad
**Thursday:** Stir-Fried Tofu with Brown Rice and Veggies
**Friday:** Grilled Shrimp Tacos with Cabbage Slaw
**Saturday:** Baked Chicken Parmesan with Whole Wheat Pasta
**Sunday:** Slow Cooker Beef Stew with Crusty Bread

**Prep Tips:**
- Marinate chicken and beef on Sunday
- Chop vegetables for the week
- Cook quinoa and rice in batches

Would you like detailed recipes for any of these?"

---

## 🔧 Implementation Examples

### JavaScript/Fetch
```javascript
async function chatWithAI(message, history = []) {
  const response = await fetch('http://localhost:5001/api/gemini/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      message: message,
      conversationHistory: history,
      conversationId: localStorage.getItem('conversationId') || `conv_${Date.now()}`
    })
  });
  
  const data = await response.json();
  return data;
}

// Usage
const response = await chatWithAI("How do I make pancakes?");
console.log(response.response);
```

### Python/Requests
```python
import requests

def chat_with_ai(message, token, history=None, conversation_id=None):
    url = "http://localhost:5001/api/gemini/chat"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    payload = {
        "message": message,
        "conversationHistory": history or [],
        "conversationId": conversation_id or f"conv_{int(time.time() * 1000)}"
    }
    
    response = requests.post(url, json=payload, headers=headers)
    return response.json()

# Usage
response = chat_with_ai("What's for dinner tonight?", your_token)
print(response['response'])
```

### React Example
```javascript
import { useState } from 'react';

function ChatBot() {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [conversationId] = useState(`conv_${Date.now()}`);

  const sendMessage = async () => {
    const response = await fetch('http://localhost:5001/api/gemini/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        message,
        conversationHistory: history,
        conversationId
      })
    });

    const data = await response.json();
    
    // Update conversation history
    setHistory([
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: data.response }
    ]);
    
    setMessage('');
  };

  return (
    <div>
      <div className="chat-history">
        {history.map((msg, idx) => (
          <div key={idx} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>
      <input 
        value={message} 
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask me anything about cooking..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
```

---

## 🎨 UI/UX Best Practices

### Conversation Display
```
┌─────────────────────────────────────┐
│  🤖 MealCart AI Assistant           │
├─────────────────────────────────────┤
│                                     │
│  You: How do I make scrambled eggs? │
│                                     │
│  🤖 AI: To make perfect scrambled   │
│  eggs, here's what you need:       │
│  1. Beat eggs with milk            │
│  2. Use low heat...                │
│                                     │
│  You: How long to cook them?       │
│                                     │
│  🤖 AI: Cook for about 3-4         │
│  minutes, stirring constantly...   │
│                                     │
├─────────────────────────────────────┤
│  [Type your message...]      [Send] │
└─────────────────────────────────────┘
```

### Features to Implement
1. **Message History:** Show previous messages in conversation
2. **Typing Indicator:** Show "AI is thinking..." while waiting
3. **Quick Actions:** Buttons for common questions
4. **Context Preservation:** Maintain conversation history
5. **Error Handling:** Graceful error messages
6. **Copy Response:** Allow users to copy AI responses

---

## 🧪 Testing Scenarios

### Test 1: Simple Question
```json
POST /api/gemini/chat
{
  "message": "What temperature should I bake chicken at?"
}
```

### Test 2: Follow-up Question
```json
POST /api/gemini/chat
{
  "message": "How long should I bake it for?",
  "conversationHistory": [
    {
      "role": "user",
      "content": "What temperature should I bake chicken at?"
    },
    {
      "role": "assistant",
      "content": "Bake chicken at 375°F (190°C) for juicy results."
    }
  ]
}
```

### Test 3: Complex Query
```json
POST /api/gemini/chat
{
  "message": "I'm allergic to dairy and gluten. Can you suggest a healthy dinner recipe for 2 people that takes less than 30 minutes?"
}
```

---

## 🔍 Troubleshooting

### Issue: Empty Response
**Solution:** Check if GEMINI_API_KEY is set in .env file

### Issue: 401 Unauthorized
**Solution:** Ensure you're sending valid JWT token in Authorization header

### Issue: 429 Quota Exceeded
**Solution:** You've hit the API rate limit. Wait a few minutes or upgrade your Gemini API plan.

### Issue: Slow Response
**Solution:** This is normal for AI generation. Consider adding a loading indicator.

---

## 📊 Rate Limiting

- **Authenticated Users:** 100 requests per 15 minutes
- **Chatbot Specific:** No additional limits beyond global rate limit

---

## 🚀 Quick Start

1. **Get JWT Token:**
```bash
# Login first
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
  
# Copy the token from response
```

2. **Send First Message:**
```bash
curl -X POST http://localhost:5001/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"message":"How do I make perfect scrambled eggs?"}'
```

3. **Continue Conversation:**
```bash
curl -X POST http://localhost:5001/api/gemini/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "message":"What if I dont have milk?",
    "conversationHistory":[
      {"role":"user","content":"How do I make perfect scrambled eggs?"},
      {"role":"assistant","content":"Beat eggs with milk, cook on low heat..."}
    ]
  }'
```

---

## 🎓 Additional AI Endpoints

### 1. Recipe Generation
`POST /api/ai/generate-recipe` - Generate complete recipes

### 2. Recipe Search
`POST /api/ai/search-recipes` - Search for recipe suggestions

### 3. General Suggestions
`POST /api/gemini/suggest` - Get AI suggestions with context

### 4. Recipe Analysis
`POST /api/gemini/analyze-recipe` - Analyze existing recipes

### 5. Meal Planning
`POST /api/gemini/meal-plan` - Generate meal plans

---

**Your AI Chatbot is ready to use! Start asking cooking questions now! 🍳**
