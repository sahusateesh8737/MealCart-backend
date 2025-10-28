# Testing Saved Recipes API

## Test 1: Get Saved Recipes

### Endpoint:
```
GET https://mealcartbackend.netlify.app/api/recipes/saved/\{YOUR_USER_ID\}
```

### Headers:
```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

### Steps:
1. Login first to get your userId and token
2. Replace {YOUR_USER_ID} with the actual userId from login response
3. Replace YOUR_TOKEN_HERE with the token from login response

### Example:
If login returns:
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "672f1234567890abcdef",
    ...
  }
}
```

Then the request would be:
```
GET https://mealcartbackend.netlify.app/api/recipes/saved/672f1234567890abcdef
Authorization: Bearer eyJhbGc...
```

## Common Issues:

1. **403 Access Denied**: userId in URL doesn't match the token
2. **401 Unauthorized**: Token is missing or invalid
3. **Empty array**: No recipes saved yet

## Alternative: Check if you have any recipes

Try this in MongoDB or ask for database check.
