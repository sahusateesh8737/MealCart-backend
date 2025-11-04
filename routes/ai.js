const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { auth, optional } = require('../middleware/auth');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const { logger } = require('../utils/logger');

const router = express.Router();

// Initialize Gemini AI safely
let genAI = null;
try {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AI] GEMINI_API_KEY not set - AI routes will return 503');
  } else {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('[AI] Gemini AI initialized successfully');
  }
} catch (error) {
  console.error('[AI] Failed to initialize Gemini AI:', error.message);
}

// Helper function to parse nutrition info from text
const parseNutritionFromText = (nutritionText) => {
  const nutrition = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0
  };

  const caloriesMatch = nutritionText.match(/calories[:\s]*(\d+(?:\.\d+)?)/i);
  const proteinMatch = nutritionText.match(/protein[:\s]*(\d+(?:\.\d+)?)/i);
  const carbsMatch = nutritionText.match(/carb(?:ohydrate)?s?[:\s]*(\d+(?:\.\d+)?)/i);
  const fatMatch = nutritionText.match(/fat[:\s]*(\d+(?:\.\d+)?)/i);
  const fiberMatch = nutritionText.match(/fiber[:\s]*(\d+(?:\.\d+)?)/i);
  const sugarMatch = nutritionText.match(/sugar[:\s]*(\d+(?:\.\d+)?)/i);
  const sodiumMatch = nutritionText.match(/sodium[:\s]*(\d+(?:\.\d+)?)/i);
  
  if (caloriesMatch) nutrition.calories = parseInt(caloriesMatch[1]);
  if (proteinMatch) nutrition.protein = parseFloat(proteinMatch[1]);
  if (carbsMatch) nutrition.carbs = parseFloat(carbsMatch[1]);
  if (fatMatch) nutrition.fat = parseFloat(fatMatch[1]);
  if (fiberMatch) nutrition.fiber = parseFloat(fiberMatch[1]);
  if (sugarMatch) nutrition.sugar = parseFloat(sugarMatch[1]);
  if (sodiumMatch) nutrition.sodium = parseFloat(sodiumMatch[1]);
  
  return nutrition;
};

// Helper function for robust JSON parsing
const parseAIResponse = (text, expectedFields = []) => {
  let jsonString = text.trim();
  
  console.log('Raw AI response (first 100 chars):', jsonString.substring(0, 100));
  logger.debug('Raw AI response received', { responseLength: jsonString.length, preview: jsonString.substring(0, 100) });
  
  // Remove markdown code blocks if present
  if (jsonString.startsWith('```')) {
    const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
      console.log('Extracted from code block (first 100 chars):', jsonString.substring(0, 100));
      logger.debug('Extracted JSON from code block', { preview: jsonString.substring(0, 100) });
    }
  }
  
  // If still no JSON, try to find JSON object
  if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
    const jsonMatch = jsonString.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
      console.log('Extracted JSON object (first 100 chars):', jsonString.substring(0, 100));
      logger.debug('Extracted JSON object from text', { preview: jsonString.substring(0, 100) });
    }
  }
  
  // Clean up common JSON formatting issues
  jsonString = jsonString
    .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
    .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/"amount":\s*(\d+)\/(\d+)/g, '"amount": $1.$2') // Convert fractions like 1/2 to 1.5, 1/4 to 1.25
    .replace(/"amount":\s*1\/2/g, '"amount": 0.5') // Specific case for 1/2
    .replace(/"amount":\s*1\/4/g, '"amount": 0.25') // Specific case for 1/4
    .replace(/"amount":\s*3\/4/g, '"amount": 0.75') // Specific case for 3/4
    .trim();
  
  console.log('Cleaned JSON (first 100 chars):', jsonString.substring(0, 100));
  logger.debug('JSON after cleaning', { preview: jsonString.substring(0, 100) });
  
  const parsed = JSON.parse(jsonString);
  
  // Validate expected fields if provided
  if (expectedFields.length > 0) {
    for (const field of expectedFields) {
      if (!(field in parsed)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
  
  return parsed;
};

// Helper function for API calls with retry logic
const callAIWithRetry = async (model, prompt, maxRetries = 3) => {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (apiError) {
      retryCount++;
      logger.warn('AI API call failed', {
        attempt: retryCount,
        maxRetries,
        error: apiError.message,
        isRetryable: apiError.message?.includes('overloaded') || apiError.message?.includes('503')
      });
      
      if (apiError.message?.includes('overloaded') || apiError.message?.includes('503')) {
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
          logger.info(`Retrying AI API call`, { waitTime: `${waitTime}ms`, attempt: retryCount + 1 });
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }
      
      // If not a retry-able error or max retries reached, throw the error
      throw apiError;
    }
  }
};

// POST /api/ai/generate-recipe - Generate a recipe using AI
router.post('/generate-recipe', auth, async (req, res) => {
  const startTime = Date.now();
  try {
    // Check if Gemini AI is initialized
    if (!genAI) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED'
      });
    }

    const {
      ingredients = [],
      servings = 4,
      cookingTime = 30,
      difficulty = 'medium',
      cuisine = '',
      mealType = 'dinner',
      dietaryRestrictions = [],
      excludeIngredients = []
    } = req.body;

    logger.logUserActivity('RECIPE_GENERATION_REQUEST', req, req.user.id, {
      ingredientsCount: ingredients.length,
      ingredients: ingredients.slice(0, 5), // Log first 5 ingredients for privacy
      servings,
      cookingTime,
      difficulty,
      cuisine,
      mealType,
      dietaryRestrictions,
      excludeIngredients
    });

    if (!ingredients || ingredients.length === 0) {
      logger.warn('Recipe generation failed - no ingredients provided', {
        userId: req.user.id
      });
      return res.status(400).json({
        success: false,
        message: 'At least one ingredient is required'
      });
    }

    // Get user's dietary preferences
    const user = await User.findById(req.user.id);
    const userDietaryRestrictions = user?.dietaryRestrictions || [];
    const userAllergens = user?.allergens || [];
    
    // Combine user preferences with request preferences
    const allDietaryRestrictions = [...new Set([...dietaryRestrictions, ...userDietaryRestrictions])];
    const allExclusions = [...new Set([...excludeIngredients, ...userAllergens])];

    const prompt = `Create a ${difficulty} ${cuisine || 'international'} ${mealType} recipe using these ingredients: ${ingredients.join(', ')}.

SERVINGS: ${servings}
COOKING TIME: ~${cookingTime} minutes
MEAL TYPE: ${mealType}
${allDietaryRestrictions.length > 0 ? `DIETARY RESTRICTIONS: ${allDietaryRestrictions.join(', ')}` : ''}
${allExclusions.length > 0 ? `EXCLUDE THESE: ${allExclusions.join(', ')}` : ''}

IMPORTANT: Return ONLY valid JSON without any markdown formatting, explanations, or additional text. 

Respond with this exact JSON structure:
{
  "title": "Recipe Name",
  "description": "Brief description of the dish",
  "ingredients": [
    {
      "name": "ingredient name",
      "amount": 1,
      "unit": "cup",
      "notes": "optional notes"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "instruction": "Detailed instruction",
      "time": 5
    }
  ],
  "cookingTime": 30,
  "prepTime": 15,
  "difficulty": "${difficulty}",
  "cuisine": "${cuisine || 'International'}",
  "dietaryTags": ["vegetarian", "gluten-free"],
  "category": "${mealType}",
  "nutritionInfo": "Calories: 400, Protein: 20g, Carbs: 45g, Fat: 15g, Fiber: 8g",
  "tips": "Optional cooking tips"
}

Make sure the recipe is realistic, balanced, and follows all dietary restrictions. Include proper cooking techniques and timing.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Call AI with retry logic
    const aiStartTime = Date.now();
    const text = await callAIWithRetry(model, prompt);
    const aiResponseTime = Date.now() - aiStartTime;

    logger.debug('AI API response received', {
      userId: req.user.id,
      aiResponseTime: `${aiResponseTime}ms`,
      responseLength: text.length
    });

    // Extract JSON from response with better error handling
    let recipeData;
    try {
      recipeData = parseAIResponse(text, ['title', 'ingredients', 'instructions']);
      
      // Ensure required fields have defaults
      recipeData.name = recipeData.title || recipeData.name || 'Untitled Recipe';
      delete recipeData.title; // Remove title, use name instead
      
    } catch (parseError) {
      logger.error('Error parsing AI response for recipe generation', {
        userId: req.user.id,
        parseError: parseError.message,
        rawResponsePreview: text.substring(0, 200)
      });
      
      // Return a simplified error response
      return res.status(500).json({
        success: false,
        message: 'AI returned malformed response. Please try again.',
        error: 'JSON_PARSE_ERROR',
        rawResponse: text.substring(0, 200) + '...' // First 200 chars for debugging
      });
    }

    // Parse nutrition information
    if (recipeData.nutritionInfo && typeof recipeData.nutritionInfo === 'string') {
      recipeData.nutritionInfo = parseNutritionFromText(recipeData.nutritionInfo);
    }

    // Ensure required fields have defaults
    recipeData.servings = servings;
    recipeData.author = req.user.id;
    recipeData.isPublic = false; // AI-generated recipes start as private

    const totalProcessingTime = Date.now() - startTime;

    // Log successful recipe generation
    logger.logRecipeGeneration(req, req.user.id, recipeData, totalProcessingTime);

    // For AI generation button, return the recipe data without saving to database
    // Users can manually save it later if they want
    res.json({
      success: true,
      data: recipeData,
      message: 'Recipe generated successfully - use the save button to add to your collection'
    });

  } catch (error) {
    const totalProcessingTime = Date.now() - startTime;
    logger.logError(error, req, {
      action: 'RECIPE_GENERATION',
      userId: req.user?.id,
      processingTime: `${totalProcessingTime}ms`,
      requestBody: {
        ingredientsCount: req.body.ingredients?.length,
        difficulty: req.body.difficulty,
        cuisine: req.body.cuisine,
        mealType: req.body.mealType
      }
    });
    res.status(500).json({
      success: false,
      message: 'Error generating recipe',
      error: error.message
    });
  }
});

// Simple placeholder endpoints for other AI features
router.post('/recognize-ingredients', auth, async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Ingredient recognition feature temporarily disabled',
    error: 'NOT_IMPLEMENTED'
  });
});

router.post('/suggest-substitutions', auth, async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Substitutions feature temporarily disabled',
    error: 'NOT_IMPLEMENTED'
  });
});

router.post('/analyze-nutrition', auth, async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Nutrition analysis feature temporarily disabled',
    error: 'NOT_IMPLEMENTED'
  });
});

router.post('/generate-meal-plan', auth, async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Meal planning feature temporarily disabled',
    error: 'NOT_IMPLEMENTED'
  });
});

// POST /api/ai/generate - Generate a recipe and grocery list from a search query
// Using optional auth - will save recipe to user's collection if authenticated
router.post('/generate', optional, async (req, res) => {
  try {
    // Check if Gemini AI is initialized
    if (!genAI) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED'
      });
    }

    const { query } = req.body;
    
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'A search query is required'
      });
    }

    const prompt = `Create a recipe for "${query}". 

IMPORTANT: Return ONLY valid JSON without any markdown formatting, explanations, or additional text.

Respond with this exact JSON structure:
{
  "title": "Recipe Name",
  "description": "Brief description of the dish",
  "ingredients": [
    "2 cups flour",
    "1 cup sugar",
    "1/2 teaspoon salt"
  ],
  "instructions": [
    "Preheat oven to 350°F",
    "Mix dry ingredients in a bowl",
    "Add wet ingredients and stir until combined"
  ],
  "cookingTime": 30,
  "prepTime": 15,
  "difficulty": "easy/medium/hard",
  "cuisine": "Type of cuisine",
  "servings": 4,
  "groceryList": [
    "Flour",
    "Sugar",
    "Salt",
    "Milk",
    "Eggs"
  ]
}

Make sure the recipe is realistic, balanced, and uses common ingredients. The groceryList should include all necessary ingredients grouped by category.`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Call AI with retry logic
    const text = await callAIWithRetry(model, prompt);

    // Extract JSON from response with better error handling
    let recipeData;
    try {
      recipeData = parseAIResponse(text, ['title', 'ingredients', 'instructions', 'groceryList']);
      
      // Ensure fields are properly set
      recipeData.name = recipeData.title || 'Untitled Recipe';
      delete recipeData.title; // Remove title, use name instead
      
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw AI response:', text);
      
      return res.status(500).json({
        success: false,
        message: 'AI returned malformed response. Please try again.',
        error: 'JSON_PARSE_ERROR'
      });
    }

    // Create a new recipe in the database only if user is authenticated
    // Anonymous users get a temporary recipe that they can save later
    let savedRecipe;
    const userId = req.user ? req.user.id : null;
    const isAuthenticated = !!userId;
    
    if (isAuthenticated) {
      try {
        // Prepare recipe data for database storage
        const recipeId = `ai_search_${Date.now()}`;
        
        const newRecipe = new Recipe({
          externalId: recipeId, // Required field
          name: recipeData.name,
          description: recipeData.description || '',
          ingredients: recipeData.ingredients.map(ingredient => ({ 
            name: ingredient,
            amount: '1',
            unit: 'item',
            original: ingredient // Required field
          })),
          instructions: recipeData.instructions.join('\n'), // Convert array to string
          cookingTime: recipeData.cookingTime || 30,
          preparationTime: recipeData.prepTime || 15,
          difficulty: recipeData.difficulty || 'medium',
          servings: recipeData.servings || 4,
          userId: userId, // This is required - only save for authenticated users
          isPublic: false,
          source: 'ai_search', // Mark as AI search-generated
          isAIGenerated: true,
          searchQuery: query, // Store the original search query
          groceryList: recipeData.groceryList || [], // Store grocery list directly
          createdAt: new Date()
        });
        
        // Save the recipe to the database
        savedRecipe = await newRecipe.save();
        
        // Log the save operation
        console.log(`Saved AI search-generated recipe to database with ID: ${savedRecipe._id}, User: ${userId}`);
        
        // Also add to user's recently generated recipes (if applicable)
        try {
          await User.findByIdAndUpdate(userId, {
            $push: { recentlyGeneratedRecipes: savedRecipe._id },
            $set: { lastRecipeGenerated: new Date() }
          });
        } catch (userUpdateError) {
          console.error('Error updating user with generated recipe:', userUpdateError);
          // Non-blocking error - continue execution
        }
      } catch (dbError) {
        console.error('Error saving generated recipe to database:', dbError);
        // Continue even if saving fails - we'll use a temporary ID
      }
    } else {
      console.log('User not authenticated - recipe will not be saved to database');
    }
    
    // Prepare recipe data to return to the client
    const recipeToReturn = savedRecipe ? {
      id: savedRecipe._id.toString(),
      name: savedRecipe.name,
      description: savedRecipe.description || '',
      ingredients: recipeData.ingredients || [], // Keep the original simple ingredient list for display
      instructions: recipeData.instructions || [], // Keep the original simple instructions for display
      cookingTime: savedRecipe.cookingTime,
      prepTime: savedRecipe.preparationTime,
      difficulty: savedRecipe.difficulty,
      cuisine: recipeData.cuisine || 'International',
      servings: savedRecipe.servings,
      source: savedRecipe.source,
      searchQuery: savedRecipe.searchQuery,
      groceryList: savedRecipe.groceryList,
      isSaved: true,  // Flag to indicate this recipe is saved in the database
      isFavorite: false, // Default value, will be updated client-side if in favorites
      savedAt: savedRecipe.createdAt
    } : {
      id: `temp_${Date.now()}`, // Fallback to temporary ID
      name: recipeData.name,
      description: recipeData.description || '',
      ingredients: recipeData.ingredients || [],
      instructions: recipeData.instructions || [],
      cookingTime: recipeData.cookingTime || 30,
      prepTime: recipeData.prepTime || 15,
      difficulty: recipeData.difficulty || 'medium',
      cuisine: recipeData.cuisine || 'International',
      servings: recipeData.servings || 4,
      source: 'ai_search',
      searchQuery: query,
      groceryList: recipeData.groceryList || [],
      isSaved: false, // Indicate this recipe is not saved in the database
      isFavorite: false
    };
    
    // Construct appropriate message based on authentication status and save status
    let responseMessage = 'Recipe generated successfully';
    
    if (isAuthenticated) {
      if (savedRecipe) {
        responseMessage = 'Recipe saved to your collection';
      } else {
        responseMessage = 'Recipe generated but could not be saved to database. Please try again.';
      }
    } else {
      responseMessage = 'Recipe generated successfully. Sign in to save it to your collection.';
    }
    
    res.json({
      success: true,
      recipe: recipeToReturn,
      groceryList: recipeData.groceryList || [],
      message: responseMessage,
      saved: !!savedRecipe,
      userId: userId || null
    });

  } catch (error) {
    console.error('Error generating recipe from search query:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating recipe',
      error: error.message
    });
  }
});

// POST /api/ai/search-recipes - Search for multiple recipe suggestions based on query
router.post('/search-recipes', async (req, res) => {
  try {
    // Check if Gemini AI is initialized
    if (!genAI) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED'
      });
    }

    const { query } = req.body;
    
    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    console.log('Searching for recipes with query:', query);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Based on the search query "${query.trim()}", provide 5-8 diverse recipe suggestions. 
    Return ONLY a valid JSON array with this exact structure for each recipe:
    [
      {
        "title": "Recipe Name",
        "description": "Brief appetizing description (max 150 chars)",
        "image": "descriptive-image-filename.jpg",
        "prepTime": "15 mins",
        "cookTime": "30 mins",
        "servings": 4,
        "difficulty": "Easy",
        "ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
        "instructions": ["Step 1", "Step 2", "Step 3"],
        "tags": ["tag1", "tag2"],
        "nutrition": {
          "calories": 350,
          "protein": 25,
          "carbs": 40,
          "fat": 12,
          "fiber": 5,
          "sugar": 8,
          "sodium": 450
        }
      }
    ]
    
    Guidelines:
    - Include variety: different cuisines, cooking methods, and difficulty levels
    - Keep ingredient lists practical (5-10 items)
    - Instructions should be clear and concise (4-8 steps)
    - Use realistic nutrition values
    - Make descriptions appealing but brief
    - Include relevant tags (cuisine type, dietary, cooking method)
    - Image filenames should be descriptive and realistic
    
    DO NOT include any text before or after the JSON array. Return ONLY the JSON array.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    console.log('Raw AI response for recipe search:', text.substring(0, 200));

    // Parse the AI response
    const recipes = parseAIResponse(text);
    
    if (!Array.isArray(recipes)) {
      throw new Error('AI did not return a valid recipe array');
    }

    // Validate and clean up the recipes
    const validRecipes = recipes.filter(recipe => {
      return recipe.title && 
             recipe.description && 
             Array.isArray(recipe.ingredients) && 
             Array.isArray(recipe.instructions) &&
             recipe.ingredients.length > 0 &&
             recipe.instructions.length > 0;
    }).map(recipe => ({
      ...recipe,
      source: 'AI Generated',
      isAIGenerated: true,
      searchQuery: query.trim(),
      nutrition: recipe.nutrition || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0
      }
    }));

    console.log(`Generated ${validRecipes.length} valid recipe suggestions`);

    res.json({
      success: true,
      data: validRecipes,
      count: validRecipes.length,
      searchQuery: query.trim()
    });

  } catch (error) {
    console.error('Error searching recipes with AI:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching recipes with AI',
      error: error.message
    });
  }
});

// POST /api/ai/save - Explicitly save a recipe to the database
router.post('/save', auth, async (req, res) => {
  const recipeController = require('../controllers/recipeController');
  
  // Call the controller function (user is guaranteed to exist due to auth middleware)
  return recipeController.saveRecipe(req, res);
});

// POST /api/ai/chat - AI Chatbot endpoint (alias to /api/gemini/chat for frontend compatibility)
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Message is required and must be a non-empty string',
        error: 'MISSING_MESSAGE'
      });
    }

    if (!genAI) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED'
      });
    }

    // Get the generative model with fallback
    let model;
    try {
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    } catch (modelError) {
      console.error('Error with gemini-2.0-flash, trying gemini-1.5-flash:', modelError);
      try {
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      } catch (fallbackError) {
        console.error('Error with gemini-1.5-flash:', fallbackError);
        return res.status(500).json({ 
          success: false,
          message: 'Failed to initialize AI model',
          error: 'MODEL_INITIALIZATION_ERROR'
        });
      }
    }

    // Build conversation context
    let conversationContext = `You are MealCart AI Assistant, a friendly and knowledgeable cooking expert. You help users with:
- Recipe recommendations and modifications
- Cooking techniques and tips
- Ingredient substitutions
- Meal planning and preparation
- Nutritional advice
- Dietary restrictions and preferences
- Grocery shopping suggestions
- Food safety and storage

Be conversational, helpful, and concise. If the question is not related to cooking or food, politely redirect to food-related topics.

`;

    // Add conversation history if provided
    if (conversationHistory.length > 0) {
      conversationContext += '\nConversation history:\n';
      conversationHistory.slice(-5).forEach(msg => {
        conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
      conversationContext += '\n';
    }

    // Add current user message
    conversationContext += `Current user message: ${message.trim()}\n\nPlease respond in a friendly, helpful manner:`;

    // Generate response with retry logic
    const text = await callAIWithRetry(model, conversationContext);

    if (!text || text.trim().length === 0) {
      return res.status(500).json({ 
        success: false,
        message: 'Empty response from AI service',
        error: 'EMPTY_AI_RESPONSE'
      });
    }

    res.json({
      success: true,
      message: 'Response generated successfully',
      response: text.trim(),
      conversationId: req.body.conversationId || `conv_${Date.now()}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('AI chatbot error:', error);

    // Handle specific API errors
    if (error.message?.includes('API key')) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid or expired API key',
        error: 'INVALID_API_KEY'
      });
    }

    if (error.message?.includes('quota')) {
      return res.status(429).json({ 
        success: false,
        message: 'API quota exceeded. Please try again later.',
        error: 'QUOTA_EXCEEDED'
      });
    }

    if (error.message?.includes('safety')) {
      return res.status(400).json({ 
        success: false,
        message: 'Content filtered for safety reasons',
        error: 'CONTENT_FILTERED'
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Server error while generating AI response',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
