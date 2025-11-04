# Postman Testing Guide - Grocery List API

## Overview
Complete guide to test all grocery list endpoints in Postman.

## Base URL
```
Local: http://localhost:5001
Production: https://mealcartbackend.netlify.app
```

---

## Prerequisites: Get Authentication Token

**Method**: `POST`  
**URL**: `http://localhost:5001/api/auth/login`  
**Headers**:
```
Content-Type: application/json
```
**Body** (raw JSON):
```json
{
  "email": "testuser1@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

📝 Copy the `token` value - you'll need it for all requests below!

---

## 1. Get Grocery List

### Request
**Method**: `GET`  
**URL**: `http://localhost:5001/api/grocerylist`  
**Headers**:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Response
```json
{
  "success": true,
  "groceryList": [],
  "itemCount": 0
}
```

---

## 2. Add Item to Grocery List

### Request
**Method**: `POST`  
**URL**: `http://localhost:5001/api/grocerylist/item`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```
**Body** (raw JSON):
```json
{
  "name": "Tomatoes",
  "amount": "2",
  "unit": "lbs",
  "category": "Produce",
  "checked": false
}
```

### Response
```json
{
  "success": true,
  "message": "Item added to grocery list",
  "item": {
    "_id": "1762236010011",
    "name": "Tomatoes",
    "amount": "2",
    "unit": "lbs",
    "category": "Produce",
    "checked": false,
    "addedAt": "2025-11-04T06:00:10.011Z"
  },
  "groceryList": [...]
}
```

### Example Items to Add
```json
{
  "name": "Milk",
  "amount": "1",
  "unit": "gallon",
  "category": "Dairy & Eggs"
}
```

```json
{
  "name": "Chicken Breast",
  "amount": "2",
  "unit": "lbs",
  "category": "Meat & Seafood"
}
```

```json
{
  "name": "Pasta",
  "amount": "1",
  "unit": "box",
  "category": "Pantry & Dry Goods"
}
```

---

## 3. Update Grocery List Item

### Request
**Method**: `PUT`  
**URL**: `http://localhost:5001/api/grocerylist/item/:itemId`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

Replace `:itemId` with actual item ID (e.g., `1762236010011`)

**Body** (raw JSON) - Update any fields:
```json
{
  "checked": true
}
```

Or update multiple fields:
```json
{
  "name": "Roma Tomatoes",
  "amount": "3",
  "unit": "lbs",
  "checked": false
}
```

### Response
```json
{
  "success": true,
  "message": "Item updated successfully",
  "item": {
    "_id": "1762236010011",
    "name": "Roma Tomatoes",
    "amount": "3",
    "unit": "lbs",
    "category": "Produce",
    "checked": false,
    "addedAt": "2025-11-04T06:00:10.011Z"
  },
  "groceryList": [...]
}
```

---

## 4. Delete Single Item

### Request
**Method**: `DELETE`  
**URL**: `http://localhost:5001/api/grocerylist/item/:itemId`  
**Headers**:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

Replace `:itemId` with actual item ID

### Response
```json
{
  "success": true,
  "message": "Item deleted successfully",
  "groceryList": [...]
}
```

---

## 5. Delete All Checked Items

### Request
**Method**: `DELETE`  
**URL**: `http://localhost:5001/api/grocerylist/checked`  
**Headers**:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Response
```json
{
  "success": true,
  "message": "1 checked item(s) removed",
  "groceryList": [...],
  "deletedCount": 1
}
```

---

## 6. Clear Entire Grocery List

### Request
**Method**: `DELETE`  
**URL**: `http://localhost:5001/api/grocerylist/clear`  
**Headers**:
```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Response
```json
{
  "success": true,
  "message": "Grocery list cleared",
  "deletedCount": 2,
  "groceryList": []
}
```

---

## Item Categories

Valid categories:
- `Produce`
- `Meat & Seafood`
- `Dairy & Eggs`
- `Pantry & Dry Goods`
- `Spices & Seasonings`
- `Condiments & Sauces`
- `Frozen`
- `Beverages`
- `Baking`
- `Canned Goods`
- `Other`

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "No token provided",
    "code": "NO_TOKEN"
  }
}
```

### 400 Bad Request
```json
{
  "success": false,
  "message": "Item name is required",
  "error": "MISSING_ITEM_NAME"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Item not found in grocery list",
  "error": "ITEM_NOT_FOUND"
}
```

---

## Postman Collection JSON

Import this into Postman:

```json
{
  "info": {
    "name": "MealCart Grocery List API",
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
      "name": "2. Get Grocery List",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "http://localhost:5001/api/grocerylist",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5001",
          "path": ["api", "grocerylist"]
        }
      }
    },
    {
      "name": "3. Add Item",
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
          "raw": "{\n  \"name\": \"Tomatoes\",\n  \"amount\": \"2\",\n  \"unit\": \"lbs\",\n  \"category\": \"Produce\"\n}"
        },
        "url": {
          "raw": "http://localhost:5001/api/grocerylist/item",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5001",
          "path": ["api", "grocerylist", "item"]
        }
      }
    },
    {
      "name": "4. Update Item",
      "request": {
        "method": "PUT",
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
          "raw": "{\n  \"checked\": true\n}"
        },
        "url": {
          "raw": "http://localhost:5001/api/grocerylist/item/{{itemId}}",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5001",
          "path": ["api", "grocerylist", "item", "{{itemId}}"]
        }
      }
    },
    {
      "name": "5. Delete Item",
      "request": {
        "method": "DELETE",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "http://localhost:5001/api/grocerylist/item/{{itemId}}",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5001",
          "path": ["api", "grocerylist", "item", "{{itemId}}"]
        }
      }
    },
    {
      "name": "6. Delete Checked Items",
      "request": {
        "method": "DELETE",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "http://localhost:5001/api/grocerylist/checked",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5001",
          "path": ["api", "grocerylist", "checked"]
        }
      }
    },
    {
      "name": "7. Clear All Items",
      "request": {
        "method": "DELETE",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "url": {
          "raw": "http://localhost:5001/api/grocerylist/clear",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5001",
          "path": ["api", "grocerylist", "clear"]
        }
      }
    }
  ]
}
```

---

## Testing Workflow

### Complete Test Flow:

1. **Login** → Get token
2. **Get List** → Verify empty list
3. **Add Tomatoes** → Get item ID from response
4. **Add Milk** → Get another item
5. **Get List** → See both items
6. **Update Tomatoes** → Mark as checked
7. **Get List** → See checked status
8. **Delete Checked** → Remove tomatoes
9. **Get List** → Only milk remains
10. **Clear All** → Empty list

---

## Environment Variables for Postman

| Variable | Value |
|----------|-------|
| `base_url` | `http://localhost:5001` |
| `token` | (set after login) |
| `itemId` | (set after adding item) |

---

## Tips

1. **Save token**: After login, save to `{{token}}` environment variable
2. **Save item IDs**: When adding items, copy `_id` for update/delete operations
3. **Check status**: Use GET endpoint frequently to verify changes
4. **Categories**: Items auto-categorize if you don't specify category
5. **Batch operations**: Use DELETE /checked to remove multiple items at once

---

## Frontend Integration Example

```javascript
// Add item
const addItem = async (item) => {
  const response = await axios.post('/api/grocerylist/item', item, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};

// Get list
const getList = async () => {
  const response = await axios.get('/api/grocerylist', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data.groceryList;
};

// Update item (toggle checked)
const toggleItem = async (itemId, checked) => {
  const response = await axios.put(`/api/grocerylist/item/${itemId}`, 
    { checked },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

// Delete checked items
const deleteChecked = async () => {
  const response = await axios.delete('/api/grocerylist/checked', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
};
```

---

## Next Steps

✅ Local server working  
⚠️ Deploy to Netlify to fix production 404 error  
✅ Test all endpoints in Postman  
✅ Update frontend to use new endpoints  

**Your frontend should now be able to use:** `POST /api/grocerylist/item` 🎉
