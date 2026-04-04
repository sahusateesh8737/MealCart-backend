const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const NodeCache = require('node-cache');
const { auth, optional } = require('../middleware/auth');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const { logger } = require('../utils/logger');

const router = express.Router();

// Initialize Cache
const aiCache = new NodeCache({ stdTTL: 86400 }); // Cache for 24 hours

// Initialize Gemini AI safely
let aiClient = null;
try {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AI] GEMINI_API_KEY not set - AI routes will return 503');
  } else {
    // New SDK initialization
    aiClient = new GoogleGenAI({ key: process.env.GEMINI_API_KEY });
    console.log('[AI] GoogleGenAI SDK initialized successfully');
  }
} catch (error) {
  console.error('[AI] Failed to initialize GoogleGenAI:', error.message);
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
    sodium: 0,
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
  logger.debug('Raw AI response received', {
    responseLength: jsonString.length,
    preview: jsonString.substring(0, 100),
  });

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
    .replace(/,\s*}/g, '}') // Remove trailing commas in objects
    .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
    // eslint-disable-next-line no-control-regex
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

// Helper function for API calls with retry logic using new SDK
const callAIWithRetry = async (client, modelName, prompt, options = {}) => {
  let maxRetries = typeof options === 'number' ? options : (options.maxRetries || 3);
  let config = options.config;
  let fallbackModels = options.fallbacks || ['gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-1.0-pro'];
  
  let retryCount = 0;
  let currentModel = modelName;

  while (retryCount < maxRetries) {
    try {
      const generateOptions = {
        model: currentModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      };

      if (config) {
        generateOptions.config = config;
      }

      const response = await client.models.generateContent(generateOptions);
      return typeof response.text === 'function' ? response.text() : response.text;
    } catch (apiError) {
      retryCount++;
      const isQuotaError = apiError.message?.includes('429') || apiError.message?.includes('quota');
      const isOverloaded = apiError.message?.includes('503') || apiError.message?.includes('overloaded');

      logger.warn('AI API call failed', {
        attempt: retryCount,
        model: currentModel,
        error: apiError.message,
        isQuotaError
      });

      if ((isQuotaError || isOverloaded) && retryCount < maxRetries) {
        // Try fallback model if available
        if (isQuotaError && fallbackModels.length > 0) {
          const nextModel = fallbackModels.shift();
          logger.info(`Switching to fallback model due to quota limit`, {
            from: currentModel,
            to: nextModel
          });
          currentModel = nextModel;
          // Shorter wait for model switch
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          // Wait before retrying same model (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        continue;
      }

      throw apiError;
    }
  }
};

// POST /api/ai/generate-recipe - Generate a recipe using AI
router.post('/generate-recipe', auth, async (req, res) => {
  const startTime = Date.now();
  try {
    // Check if Gemini AI is initialized
    if (!aiClient) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED',
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
      excludeIngredients = [],
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
      excludeIngredients,
    });

    if (!ingredients || ingredients.length === 0) {
      logger.warn('Recipe generation failed - no ingredients provided', {
        userId: req.user.id,
      });
      return res.status(400).json({
        success: false,
        message: 'At least one ingredient is required',
      });
    }

    // Get user's dietary preferences
    const user = await User.findById(req.user.id);
    const userDietaryRestrictions = user?.dietaryRestrictions || [];
    const userAllergens = user?.allergens || [];

    // Combine user preferences with request preferences
    const allDietaryRestrictions = [
      ...new Set([...dietaryRestrictions, ...userDietaryRestrictions]),
    ];
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

    // Call AI with retry logic using new SDK and gemini-2.5-flash
    const aiStartTime = Date.now();
    let text;

    try {
      text = await callAIWithRetry(aiClient, 'gemini-2.5-flash', prompt);
    } catch (primaryError) {
      console.warn('Primary model (gemini-2.5-flash) failed:', primaryError.message);
      try {
        console.warn('Attempting fallback to gemini-2.0-flash');
        text = await callAIWithRetry(aiClient, 'gemini-2.0-flash', prompt);
      } catch (fallbackError) {
        throw primaryError;
      }
    }

    const aiResponseTime = Date.now() - aiStartTime;

    logger.debug('AI API response received', {
      userId: req.user.id,
      aiResponseTime: `${aiResponseTime}ms`,
      responseLength: text.length,
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
        rawResponsePreview: text.substring(0, 200),
      });

      // Return a simplified error response
      return res.status(500).json({
        success: false,
        message: 'AI returned malformed response. Please try again.',
        error: 'JSON_PARSE_ERROR',
        rawResponse: text.substring(0, 200) + '...', // First 200 chars for debugging
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
      message: 'Recipe generated successfully - use the save button to add to your collection',
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
        mealType: req.body.mealType,
      },
    });
    res.status(500).json({
      success: false,
      message: 'Error generating recipe',
      error: error.message,
    });
  }
});

// POST /api/ai/chat - Conversational interface
router.post('/chat', auth, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required and must be a non-empty string',
        error: 'MISSING_MESSAGE',
      });
    }

    // Check if Gemini AI is initialized
    if (!aiClient) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED',
      });
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
      conversationHistory.slice(-5).forEach((msg) => {
        conversationContext += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
      conversationContext += '\n';
    }

    // Add current user message
    conversationContext += `Current user message: ${message.trim()}\n\nPlease respond in a friendly, helpful manner:`;

    // Generate response using existing retry logic
    const aiResponse = await callAIWithRetry(aiClient, 'gemini-2.0-flash', conversationContext);

    if (!aiResponse || aiResponse.trim().length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Empty response from AI service',
        error: 'EMPTY_AI_RESPONSE',
      });
    }

    res.json({
      success: true,
      message: 'Response generated successfully',
      response: aiResponse.trim(),
      conversationId: req.body.conversationId || `conv_${Date.now()}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('AI chatbot error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating AI response',
      error: error.message,
    });
  }
});

// Gemini AI suggestion endpoint
router.post('/suggest', auth, async (req, res) => {
  try {
    const { prompt, context = 'general' } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required and must be a non-empty string',
        error: 'MISSING_PROMPT',
      });
    }

    if (!aiClient) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED',
      });
    }

    // Create context-specific prompts
    const contextualPrompt = createContextualPrompt(prompt, context);

    // Generate response using retry logic
    const text = await callAIWithRetry(aiClient, 'gemini-2.0-flash', contextualPrompt);

    if (!text || text.trim().length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Empty response from AI service',
        error: 'EMPTY_AI_RESPONSE',
      });
    }

    res.json({
      success: true,
      message: 'AI suggestion generated successfully',
      suggestion: text.trim(),
      context,
      prompt: prompt.trim(),
      usage: {
        promptLength: contextualPrompt.length,
        responseLength: text.length,
      },
    });
  } catch (error) {
    logger.error('Gemini AI suggestion error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating AI suggestion',
      error: error.message,
    });
  }
});

// Recipe analysis endpoint
router.post('/analyze-recipe', auth, async (req, res) => {
  try {
    const { recipe, analysisType = 'general' } = req.body;

    if (!recipe || typeof recipe !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Recipe object is required',
        error: 'MISSING_RECIPE',
      });
    }

    if (!aiClient) {
      return res.status(503).json({
        success: false,
        message: 'Gemini AI not available',
        error: 'AI_NOT_AVAILABLE',
      });
    }

    let analysisPrompt;
    switch (analysisType) {
      case 'nutrition':
        analysisPrompt = createNutritionAnalysisPrompt(recipe);
        break;
      case 'substitutions':
        analysisPrompt = createSubstitutionPrompt(recipe);
        break;
      case 'difficulty':
        analysisPrompt = createDifficultyAnalysisPrompt(recipe);
        break;
      case 'improvements':
        analysisPrompt = createImprovementPrompt(recipe);
        break;
      default:
        analysisPrompt = createGeneralRecipeAnalysisPrompt(recipe);
    }

    const text = await callAIWithRetry(aiClient, 'gemini-2.0-flash', analysisPrompt);

    res.json({
      success: true,
      message: 'Recipe analysis completed',
      analysis: text.trim(),
      analysisType,
      recipe: {
        name: recipe.name,
        id: recipe.id || recipe._id,
      },
    });
  } catch (error) {
    logger.error('Recipe analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during recipe analysis',
      error: error.message,
    });
  }
});

// Helper alias for analyze-nutrition (legacy support)
router.post('/analyze-nutrition', auth, async (req, res) => {
  req.body.analysisType = 'nutrition';
  // Forward to analyze-recipe logic manually since we can't internally redirect easily in express
  // duplicating minimal logic or calling the handler if extracted, but for now just inline call:
  return router.handle({ ...req, url: '/analyze-recipe' }, res);
});

// Helper alias for suggest-substitutions (legacy support)
router.post('/suggest-substitutions', auth, async (req, res) => {
  req.body.analysisType = 'substitutions';
  return router.handle({ ...req, url: '/analyze-recipe' }, res);
});

// Meal planning suggestion endpoint
router.post('/generate-meal-plan', auth, async (req, res) => {
  try {
    const {
      dietaryRestrictions = [],
      preferredIngredients = [],
      daysCount = 7,
      mealsPerDay = 3,
      cookingSkill = 'intermediate',
    } = req.body;

    if (!aiClient) {
      return res.status(503).json({
        success: false,
        message: 'Gemini AI not available',
        error: 'AI_NOT_AVAILABLE',
      });
    }

    const mealPlanPrompt = createMealPlanPrompt({
      dietaryRestrictions,
      preferredIngredients,
      daysCount,
      mealsPerDay,
      cookingSkill,
    });

    let text;
    try {
      console.log('Generating meal plan with gemini-2.5-flash...');
      text = await callAIWithRetry(aiClient, 'gemini-2.5-flash', mealPlanPrompt);
    } catch (primaryError) {
      console.warn('Primary model (gemini-2.5-flash) failed:', primaryError.message);

      const isQuotaError =
        primaryError.message?.includes('429') || primaryError.message?.includes('quota');
      const isOverloaded =
        primaryError.message?.includes('503') || primaryError.message?.includes('overloaded');

      if (isQuotaError || isOverloaded) {
        console.log('Attempting fallback to gemini-1.5-flash due to rate limits...');
        try {
          text = await callAIWithRetry(aiClient, 'gemini-1.5-flash', mealPlanPrompt);
        } catch (fallbackError) {
          console.error('Fallback model (gemini-1.5-flash) also failed:', fallbackError.message);
          throw primaryError; // Throw original error to preserve 429 status
        }
      } else {
        throw primaryError;
      }
    }

    // Parse the AI response
    let mealPlanData;
    try {
      mealPlanData = parseAIResponse(text);
    } catch (parseError) {
      console.error('Error parsing meal plan JSON:', parseError);
      throw new Error('Failed to parse AI response');
    }

    res.json({
      success: true,
      message: 'Meal plan generated successfully',
      mealPlan: mealPlanData,
      parameters: {
        dietaryRestrictions,
        preferredIngredients,
        daysCount,
        mealsPerDay,
        cookingSkill,
      },
    });
  } catch (error) {
    logger.error('Meal plan generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during meal plan generation',
      error: error.message,
    });
  }
});

// Alias for simpler route
router.post('/meal-plan', auth, async (req, res) => {
  return router.handle({ ...req, url: '/generate-meal-plan' }, res);
});

// POST /api/ai/generate - Generate a recipe and grocery list from a search query
// Using optional auth - will save recipe to user's collection if authenticated
router.post('/generate', optional, async (req, res) => {
  try {
    // Check if Gemini AI is initialized
    if (!aiClient) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED',
      });
    }

    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'A search query is required',
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
    "1 cup sugar"
  ],
  "instructions": [
    "Preheat oven to 350°F",
    "Mix ingredients"
  ],
  "cookingTime": 30,
  "prepTime": 15,
  "difficulty": "easy/medium/hard",
  "cuisine": "Type of cuisine",
  "servings": 4
}

Make sure the recipe is realistic. Return ONLY the JSON.`;

    // Use the fast and stable model directly
    const text = await callAIWithRetry(aiClient, 'gemini-2.5-flash', prompt, {
      config: { responseMimeType: 'application/json' },
    });

    // Extract JSON from response with better error handling
    let recipeData;
    try {
      recipeData = parseAIResponse(text, ['title', 'ingredients', 'instructions']);

      // Ensure fields are properly set
      recipeData.name = recipeData.title || 'Untitled Recipe';
      delete recipeData.title; // Remove title, use name instead
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw AI response:', text);
      require('fs').writeFileSync(
        'debug_ai_response.txt',
        'Error: ' + parseError.message + '\n\nRaw Response:\n' + text
      );

      return res.status(500).json({
        success: false,
        message: 'AI returned malformed response. Please try again.',
        error: 'JSON_PARSE_ERROR',
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
        const recipeId = 'ai_search_' + Date.now();

        const newRecipe = new Recipe({
          externalId: recipeId, // Required field
          name: recipeData.name,
          description: recipeData.description || '',
          ingredients: recipeData.ingredients.map((ingredient) => ({
            name: ingredient,
            amount: '1',
            unit: 'item',
            original: ingredient, // Required field
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
          createdAt: new Date(),
        });

        // Save the recipe to the database
        savedRecipe = await newRecipe.save();

        // Log the save operation
        console.log(
          'Saved AI search - generated recipe to database with ID: ' +
            savedRecipe._id +
            ', User: ' +
            userId
        );

        // Also add to user's recently generated recipes (if applicable)
        try {
          await User.findByIdAndUpdate(userId, {
            $push: { recentlyGeneratedRecipes: savedRecipe._id },
            $set: { lastRecipeGenerated: new Date() },
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
    const recipeToReturn = savedRecipe
      ? {
          _id: savedRecipe._id.toString(), // Added _id so frontend detects it as saved
          id: savedRecipe._id.toString(),
          externalId: savedRecipe.externalId, // Added externalId
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
          isSaved: true, // Flag to indicate this recipe is saved in the database
          isFavorite: false, // Default value, will be updated client-side if in favorites
          savedAt: savedRecipe.createdAt,
        }
      : {
          id: 'temp_' + Date.now(), // Fallback to temporary ID
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
          isFavorite: false,
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
      userId: userId || null,
    });
  } catch (error) {
    console.error('Error generating recipe from search query:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating recipe',
      error: error.message,
    });
  }
});

// POST /api/ai/search-recipes - Search for multiple recipe suggestions based on query
router.post('/search-recipes', async (req, res) => {
  try {
    const { query } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    // Check cache first
    const cacheKey = 'search:' + query.trim().toLowerCase();
    const cachedResult = aiCache.get(cacheKey);
    if (cachedResult) {
      console.log('[AI] Serving cached results for query: "' + query + '"');
      return res.json({
        success: true,
        data: cachedResult,
        count: cachedResult.length,
        searchQuery: query.trim(),
        cached: true,
      });
    }

    // Check if Gemini AI is initialized
    if (!aiClient) {
      console.warn('[AI] Gemini AI not initialized - check GEMINI_API_KEY');
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
        error: 'GEMINI_NOT_INITIALIZED',
      });
    }

    console.log('Searching for recipes with query:', query);

    const prompt = `Based on the search query "${query.trim()}", provide 5 - 8 diverse recipe suggestions. 
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
          "mealType": ["dinner"],
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
      - Keep ingredient lists practical(5 - 10 items)
        - Instructions should be clear and concise(4 - 8 steps)
          - Use realistic nutrition values
            - Make descriptions appealing but brief
              - Include relevant tags(cuisine type, dietary, cooking method)
                - Identify meal types(breakfast, lunch, dinner, snack, dessert)
                  - Image filenames should be descriptive and realistic
    
    DO NOT include any text before or after the JSON array.Return ONLY the JSON array.`;

    // Try primary model first (Gemini 2.5 Flash) with new SDK
    let text;
    try {
      // Attempt generation with retries using primary model
      text = await callAIWithRetry(aiClient, 'gemini-2.5-flash', prompt);
    } catch (primaryError) {
      console.warn('Primary model (gemini-2.5-flash) failed:', primaryError.message);

      // Check if we should try fallback (429 Quota or 503 Overloaded)
      const isQuotaError =
        primaryError.message?.includes('429') || primaryError.message?.includes('quota');
      const isOverloaded =
        primaryError.message?.includes('503') || primaryError.message?.includes('overloaded');

      // Also fallback if model not found (maybe 2.5 isn't available to them yet?)
      const isModelError =
        primaryError.message?.includes('model') || primaryError.message?.includes('not found');

      if (isQuotaError || isOverloaded || isModelError) {
        console.log('Attempting fallback to gemini-1.5-flash due to issues...');
        try {
          // Attempt generation with fallback model
          text = await callAIWithRetry(aiClient, 'gemini-1.5-flash', prompt);
        } catch (fallbackError) {
          console.error('Fallback model (gemini-1.5-flash) also failed:', fallbackError);

          if (isQuotaError) {
            return res.status(429).json({
              success: false,
              message: 'AI service quota exceeded. Please try again later.',
              error: 'QUOTA_EXCEEDED',
            });
          }

          return res.status(503).json({
            success: false,
            message: 'AI service is currently busy. Please try again later.',
            error: 'AI_SERVICE_UNAVAILABLE',
          });
        }
      } else {
        console.error('Non-retryable AI error:', primaryError);
        return res.status(500).json({
          success: false,
          message: 'Error generating recipes',
          error: primaryError.message,
        });
      }
    }

    console.log('Raw AI response for recipe search (preview):', text.substring(0, 100));

    // Parse the AI response with better error handling
    let recipes;
    try {
      recipes = parseAIResponse(text);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw text that failed parsing:', text);
      return res.status(500).json({
        success: false,
        message: 'Failed to parse AI response',
        error: 'JSON_PARSE_ERROR',
        details: parseError.message,
      });
    }

    if (!Array.isArray(recipes)) {
      console.error('AI did not return an array:', recipes);
      return res.status(500).json({
        success: false,
        message: 'AI returned invalid data format',
        error: 'INVALID_DATA_FORMAT',
      });
    }

    // Validate and clean up the recipes
    const validRecipes = recipes
      .filter((recipe) => {
        // Basic validation
        const isValid =
          recipe.title &&
          recipe.description &&
          Array.isArray(recipe.ingredients) &&
          Array.isArray(recipe.instructions);

        if (!isValid) {
          console.warn('Skipping invalid recipe:', recipe.title || 'Unknown');
        }
        return isValid;
      })
      .map((recipe) => ({
        ...recipe,
        source: 'AI Generated',
        isAIGenerated: true,
        searchQuery: query.trim(),
        mealType: recipe.mealType || [],
        nutrition: recipe.nutrition || {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: 0,
        },
      }));

    if (validRecipes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid recipes could be generated. Please try a different query.',
        error: 'NO_VALID_RECIPES',
      });
    }

    console.log('Generated ' + validRecipes.length + ' valid recipe suggestions');

    // Cache the successful result
    aiCache.set(cacheKey, validRecipes);

    res.json({
      success: true,
      data: validRecipes,
      count: validRecipes.length,
      searchQuery: query.trim(),
    });
  } catch (error) {
    console.error('Error searching recipes with AI:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching recipes with AI',
      error: error.message,
    });
  }
});

// POST /api/ai/save - Explicitly save a recipe to the database
router.post('/save', auth, async (req, res) => {
  const recipeController = require('../controllers/recipeController');

  // Call the controller function (user is guaranteed to exist due to auth middleware)
  return recipeController.saveRecipe(req, res);
});

// Helper functions for creating contextual prompts
function createContextualPrompt(prompt, context) {
  const baseContext =
    'You are a helpful cooking and recipe assistant. Provide practical, accurate, and concise advice.';

  const contextPrompts = {
    'ingredient-substitution': `${baseContext} Focus on ingredient substitutions and alternatives.User's question: ${prompt}`,
    'cooking-tips': `${baseContext} Provide cooking tips and techniques. User's question: ${prompt}`,
    nutrition: `${baseContext} Focus on nutritional information and healthy cooking advice. User's question: ${prompt}`,
    'meal-planning': `${baseContext} Help with meal planning and preparation. User's question: ${prompt}`,
    'dietary-restrictions': `${baseContext} Provide advice considering dietary restrictions and allergies. User's question: ${prompt}`,
    general: `${baseContext} User's question: ${prompt}`,
  };

  return contextPrompts[context] || contextPrompts['general'];
}

function createNutritionAnalysisPrompt(recipe) {
  return `Analyze the nutritional aspects of this recipe:
Name: ${recipe.name || recipe.title || 'Untitled'}
Ingredients: ${recipe.ingredients?.map((ing) => (typeof ing === 'string' ? ing : ing.original || ing.name)).join(', ')}
Servings: ${recipe.servings || 'Not specified'}

Please provide:
1. Estimated calories per serving
2. Main macronutrients (protein, carbs, fats)
3. Key vitamins and minerals
4. Health benefits
5. Suggestions for making it healthier
Keep the analysis practical and easy to understand.`;
}

function createSubstitutionPrompt(recipe) {
  return `Suggest ingredient substitutions for this recipe:
Name: ${recipe.name || recipe.title || 'Untitled'}
Ingredients: ${recipe.ingredients?.map((ing) => (typeof ing === 'string' ? ing : ing.original || ing.name)).join(', ')}

Please provide:
1. Common substitutions for each major ingredient
2. Dairy-free alternatives if applicable
3. Gluten-free alternatives if applicable
4. Vegan alternatives if applicable
5. Low-sodium alternatives if applicable
Focus on easily available substitutions that won't significantly change the recipe's character.`;
}

function createDifficultyAnalysisPrompt(recipe) {
  return `Analyze the cooking difficulty of this recipe:
Name: ${recipe.name || recipe.title || 'Untitled'}
Ingredients: ${recipe.ingredients?.map((ing) => (typeof ing === 'string' ? ing : ing.original || ing.name)).join(', ')}
Instructions: ${Array.isArray(recipe.instructions) ? recipe.instructions.join('\n') : recipe.instructions || 'Not provided'}
Cooking Time: ${recipe.cookingTime || 'Not specified'} minutes

Please assess:
1. Skill level required (beginner/intermediate/advanced)
2. Time complexity
3. Equipment needed
4. Challenging techniques involved
5. Tips to make it easier for beginners`;
}

function createImprovementPrompt(recipe) {
  return `Suggest improvements for this recipe:
Name: ${recipe.name || recipe.title || 'Untitled'}
Ingredients: ${recipe.ingredients?.map((ing) => (typeof ing === 'string' ? ing : ing.original || ing.name)).join(', ')}
Instructions: ${Array.isArray(recipe.instructions) ? recipe.instructions.join('\n') : recipe.instructions || 'Not provided'}

Please suggest:
1. Flavor enhancement ideas
2. Texture improvements
3. Presentation tips
4. Efficiency improvements
5. Nutritional upgrades
Keep suggestions practical and achievable.`;
}

function createGeneralRecipeAnalysisPrompt(recipe) {
  return `Provide a comprehensive analysis of this recipe:
Name: ${recipe.name || recipe.title || 'Untitled'}
Ingredients: ${recipe.ingredients?.map((ing) => (typeof ing === 'string' ? ing : ing.original || ing.name)).join(', ')}
Instructions: ${Array.isArray(recipe.instructions) ? recipe.instructions.join('\n') : recipe.instructions || 'Not provided'}

Please cover:
1. Overall assessment
2. Key flavors and cuisine style
3. Difficulty level
4. Nutritional highlights
5. Serving suggestions
6. Storage and reheating tips`;
}

function createMealPlanPrompt(params) {
  return `Create a ${params.daysCount}-day meal plan with ${params.mealsPerDay} meals per day.

Requirements:
- Cooking skill level: ${params.cookingSkill}
- Dietary restrictions: ${params.dietaryRestrictions.join(', ') || 'None'}
- Preferred ingredients: ${params.preferredIngredients.join(', ') || 'None specified'}
- Calories per day: ${params.calories || '2000'} (approximate)

IMPORTANT: Return ONLY valid JSON without any markdown formatting, explanations, or additional text.

Respond with this exact JSON structure:
{
  "plan": [
    {
      "day": 1,
      "meals": {
        "breakfast": {
          "name": "Recipe Name",
          "description": "Brief description",
          "cookingTime": 15,
          "calories": 400,
          "ingredients": ["egg", "toast"],
          "instructions": ["Fry egg", "Toast bread"]
        },
        "lunch": { ... },
        "dinner": { ... },
        "snack": { ... } (if 4 meals)
      }
    }
  ],
  "shoppingList": [
    { "category": "Produce", "items": ["Apples", "Bananas"] }
  ]
}

Ensure all recipe details (ingredients, instructions) are included so they can be saved as real recipes.`;
}

// mealKart AI Assistant Endpoint
router.post('/recipe-assistant', auth, async (req, res) => {
  try {
    const { recipe, message } = req.body;

    if (!recipe || !message) {
      return res.status(400).json({
        success: false,
        message: 'Recipe context and message are required',
      });
    }

    if (!aiClient) {
      return res.status(503).json({
        success: false,
        message: 'AI service not available',
      });
    }

    const recipeContext = `
    RECIPE: ${recipe.name || recipe.title}
    CUISINE: ${recipe.cuisine || 'International'}
    INGREDIENTS: ${Array.isArray(recipe.ingredients) ? recipe.ingredients.map(i => typeof i === 'string' ? i : i.name).join(', ') : ''}
    INSTRUCTIONS: ${Array.isArray(recipe.instructions) ? recipe.instructions.map(i => typeof i === 'string' ? i : i.instruction).join(' ') : recipe.instructions}
    `;

    const prompt = `
    You are "mealKart AI", a Michelin-branded AI culinary expert for the mealKart app. 
    Your tone is professional, sophisticated, encouraging, and deeply knowledgeable. 
    You are part of the "Master Chef Tier" experience.

    Use the following recipe context to answer the user's question:
    ---
    ${recipeContext}
    ---

    USER QUESTION: "${message}"

    GUIDELINES:
    1. Provide specific, expert advice related only to this recipe or its ingredients.
    2. Suggest Michelin-level refinements, precise substitutions, or sophisticated pairings.
    3. Keep the response concise but impactful (max 3-4 sentences).
    4. Maintain the persona of a world-class chef/sommelier.
    5. Always focus on culinary excellence.

    Respond directly as mealKart AI:`;

    let aiResponse;
    try {
      aiResponse = await callAIWithRetry(aiClient, 'gemini-2.5-flash', prompt);
    } catch (primaryError) {
      console.warn('Sommelier primary model (gemini-2.5-flash) failed, attempting fallback to gemini-2.0-flash');
      aiResponse = await callAIWithRetry(aiClient, 'gemini-2.0-flash', prompt);
    }

    res.json({
      success: true,
      response: aiResponse.trim(),
    });
  } catch (error) {
    logger.error('mealKart AI error:', error);
    res.status(500).json({
      success: false,
      message: 'mealKart AI is temporarily unavailable',
      error: error.message,
    });
  }
});

module.exports = router;
