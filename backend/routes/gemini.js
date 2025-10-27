const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Initialize Gemini AI safely
let genAI = null;
try {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[Gemini] GEMINI_API_KEY not set - Gemini routes will return 503');
  } else {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('[Gemini] Gemini AI initialized successfully');
  }
} catch (error) {
  console.error('[Gemini] Failed to initialize Gemini AI:', error.message);
}

// Gemini AI suggestion endpoint
router.post('/suggest', auth, async (req, res) => {
  try {
    const { prompt, context = 'general' } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ 
        message: 'Prompt is required and must be a non-empty string',
        error: 'MISSING_PROMPT'
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ 
        message: 'Gemini API key not configured',
        error: 'API_KEY_MISSING'
      });
    }

    if (!genAI) {
      console.error('Attempting to reinitialize Gemini AI...');
      try {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        console.log('Gemini AI reinitialized successfully');
      } catch (reinitError) {
        console.error('Failed to reinitialize Gemini AI:', reinitError);
        return res.status(500).json({ 
          message: 'Gemini AI not properly initialized',
          error: 'AI_INITIALIZATION_ERROR'
        });
      }
    }

    // Get the generative model with fallback models
    let model;
    try {
      // Try the latest available model first
      model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    } catch (modelError) {
      console.error('Error with gemini-2.0-flash, trying gemini-1.5-flash:', modelError);
      try {
        // Fallback to gemini-1.5-flash
        model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      } catch (fallbackError) {
        console.error('Error with gemini-1.5-flash:', fallbackError);
        return res.status(500).json({ 
          message: 'Failed to initialize AI model',
          error: 'MODEL_INITIALIZATION_ERROR'
        });
      }
    }

    // Create context-specific prompts
    const contextualPrompt = createContextualPrompt(prompt, context);

    // Generate response
    const result = await model.generateContent(contextualPrompt);
    const response = await result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      return res.status(500).json({ 
        message: 'Empty response from AI service',
        error: 'EMPTY_AI_RESPONSE'
      });
    }

    res.json({
      message: 'AI suggestion generated successfully',
      suggestion: text.trim(),
      context,
      prompt: prompt.trim(),
      usage: {
        promptLength: contextualPrompt.length,
        responseLength: text.length
      }
    });
  } catch (error) {
    console.error('Gemini AI suggestion error:', error);

    // Handle specific API errors
    if (error.message?.includes('API key')) {
      return res.status(401).json({ 
        message: 'Invalid or expired API key',
        error: 'INVALID_API_KEY'
      });
    }

    if (error.message?.includes('quota')) {
      return res.status(429).json({ 
        message: 'API quota exceeded. Please try again later.',
        error: 'QUOTA_EXCEEDED'
      });
    }

    if (error.message?.includes('safety')) {
      return res.status(400).json({ 
        message: 'Content filtered for safety reasons',
        error: 'CONTENT_FILTERED'
      });
    }

    res.status(500).json({ 
      message: 'Server error while generating AI suggestion',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Recipe analysis endpoint
router.post('/analyze-recipe', auth, async (req, res) => {
  try {
    const { recipe, analysisType = 'general' } = req.body;

    if (!recipe || typeof recipe !== 'object') {
      return res.status(400).json({ 
        message: 'Recipe object is required',
        error: 'MISSING_RECIPE'
      });
    }

    if (!process.env.GEMINI_API_KEY || !genAI) {
      return res.status(500).json({ 
        message: 'Gemini AI not available',
        error: 'AI_NOT_AVAILABLE'
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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

    const result = await model.generateContent(analysisPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({
      message: 'Recipe analysis completed',
      analysis: text.trim(),
      analysisType,
      recipe: {
        name: recipe.name,
        id: recipe.id || recipe._id
      }
    });
  } catch (error) {
    console.error('Recipe analysis error:', error);
    res.status(500).json({ 
      message: 'Server error during recipe analysis',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Meal planning suggestion endpoint
router.post('/meal-plan', auth, async (req, res) => {
  try {
    const { 
      dietaryRestrictions = [], 
      preferredIngredients = [], 
      daysCount = 7,
      mealsPerDay = 3,
      cookingSkill = 'intermediate'
    } = req.body;

    if (!process.env.GEMINI_API_KEY || !genAI) {
      return res.status(500).json({ 
        message: 'Gemini AI not available',
        error: 'AI_NOT_AVAILABLE'
      });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const mealPlanPrompt = createMealPlanPrompt({
      dietaryRestrictions,
      preferredIngredients,
      daysCount,
      mealsPerDay,
      cookingSkill
    });

    const result = await model.generateContent(mealPlanPrompt);
    const response = await result.response;
    const text = response.text();

    res.json({
      message: 'Meal plan generated successfully',
      mealPlan: text.trim(),
      parameters: {
        dietaryRestrictions,
        preferredIngredients,
        daysCount,
        mealsPerDay,
        cookingSkill
      }
    });
  } catch (error) {
    console.error('Meal plan generation error:', error);
    res.status(500).json({ 
      message: 'Server error during meal plan generation',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Helper functions for creating contextual prompts
function createContextualPrompt(prompt, context) {
  const baseContext = "You are a helpful cooking and recipe assistant. Provide practical, accurate, and concise advice.";
  
  const contextPrompts = {
    'ingredient-substitution': `${baseContext} Focus on ingredient substitutions and alternatives. User's question: ${prompt}`,
    'cooking-tips': `${baseContext} Provide cooking tips and techniques. User's question: ${prompt}`,
    'nutrition': `${baseContext} Focus on nutritional information and healthy cooking advice. User's question: ${prompt}`,
    'meal-planning': `${baseContext} Help with meal planning and preparation. User's question: ${prompt}`,
    'dietary-restrictions': `${baseContext} Provide advice considering dietary restrictions and allergies. User's question: ${prompt}`,
    'general': `${baseContext} User's question: ${prompt}`
  };

  return contextPrompts[context] || contextPrompts['general'];
}

function createNutritionAnalysisPrompt(recipe) {
  return `Analyze the nutritional aspects of this recipe:
Name: ${recipe.name}
Ingredients: ${recipe.ingredients?.map(ing => ing.original || ing.name).join(', ')}
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
Name: ${recipe.name}
Ingredients: ${recipe.ingredients?.map(ing => ing.original || ing.name).join(', ')}

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
Name: ${recipe.name}
Ingredients: ${recipe.ingredients?.map(ing => ing.original || ing.name).join(', ')}
Instructions: ${recipe.instructions || 'Not provided'}
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
Name: ${recipe.name}
Ingredients: ${recipe.ingredients?.map(ing => ing.original || ing.name).join(', ')}
Instructions: ${recipe.instructions || 'Not provided'}

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
Name: ${recipe.name}
Ingredients: ${recipe.ingredients?.map(ing => ing.original || ing.name).join(', ')}
Instructions: ${recipe.instructions || 'Not provided'}

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

Please provide:
1. Day-by-day meal schedule
2. Brief description of each meal
3. Estimated prep time for each meal
4. Shopping list organized by category
5. Prep tips for the week

Format the response clearly with headers for each day and meal type.`;
}

module.exports = router;
