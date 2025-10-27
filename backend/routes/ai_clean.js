const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Recipe = require('../models/Recipe');

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
  
  // Remove markdown code blocks if present
  if (jsonString.startsWith('```')) {
    const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1].trim();
      console.log('Extracted from code block (first 100 chars):', jsonString.substring(0, 100));
    }
  }
  
  // If still no JSON, try to find JSON object
  if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
    const jsonMatch = jsonString.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      jsonString = jsonMatch[1];
      console.log('Extracted JSON object (first 100 chars):', jsonString.substring(0, 100));
    }
  }
  
  // Clean up common JSON formatting issues
  jsonString = jsonString
    .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
    .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .trim();
  
  console.log('Cleaned JSON (first 100 chars):', jsonString.substring(0, 100));
  
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
      console.log(`API call attempt ${retryCount} failed:`, apiError.message);
      
      if (apiError.message?.includes('overloaded') || apiError.message?.includes('503')) {
        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
          console.log(`Waiting ${waitTime}ms before retry...`);
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
  try {
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

    if (!ingredients || ingredients.length === 0) {
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Call AI with retry logic
    const text = await callAIWithRetry(model, prompt);

    // Extract JSON from response with better error handling
    let recipeData;
    try {
      recipeData = parseAIResponse(text, ['title', 'ingredients', 'instructions']);
      
      // Ensure required fields have defaults
      recipeData.name = recipeData.title || recipeData.name || 'Untitled Recipe';
      delete recipeData.title; // Remove title, use name instead
      
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw AI response:', text);
      
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

    res.json({
      success: true,
      data: recipeData,
      message: 'Recipe generated successfully'
    });

  } catch (error) {
    console.error('Error generating recipe:', error);
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

module.exports = router;
