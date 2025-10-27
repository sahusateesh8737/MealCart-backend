const fetch = require('node-fetch');
const Recipe = require('../models/Recipe');

// Search recipes from external API
const searchRecipes = async (req, res) => {
  try {
    const { 
      query, // For text-based search
      ingredients, // For ingredient-based search
      diet, 
      intolerances, 
      number = 12, 
      offset = 0,
      type,
      maxReadyTime
    } = req.query;

    // Validation - need either query or ingredients
    if (!query && !ingredients) {
      return res.status(400).json({ 
        success: false,
        message: 'Either query or ingredients parameter is required',
        error: 'MISSING_SEARCH_PARAMS',
        data: []
      });
    }

    if (!process.env.SPOONACULAR_API_KEY) {
      return res.status(500).json({ 
        success: false,
        message: 'Recipe API service is currently unavailable',
        error: 'API_SERVICE_UNAVAILABLE',
        data: []
      });
    }

    let searchUrl;
    
    // Choose appropriate endpoint based on search type
    if (ingredients) {
      // Use findByIngredients endpoint for ingredient-based search
      const baseUrl = 'https://api.spoonacular.com/recipes/findByIngredients';
      const params = new URLSearchParams({
        apiKey: process.env.SPOONACULAR_API_KEY,
        ingredients: ingredients.toString(),
        number: Math.min(parseInt(number), 100),
        offset: parseInt(offset),
        ranking: 2, // Maximize used ingredients
        ignorePantry: true
      });
      searchUrl = `${baseUrl}?${params}`;
    } else {
      // Use complexSearch endpoint for text-based search
      const baseUrl = 'https://api.spoonacular.com/recipes/complexSearch';
      const params = new URLSearchParams({
        apiKey: process.env.SPOONACULAR_API_KEY,
        query: query.toString(),
        number: Math.min(parseInt(number), 100),
        offset: parseInt(offset),
        addRecipeInformation: true,
        fillIngredients: true
      });
      
      // Add optional filters
      if (diet) params.append('diet', diet);
      if (intolerances) params.append('intolerances', intolerances);
      if (type) params.append('type', type);
      if (maxReadyTime) params.append('maxReadyTime', maxReadyTime);
      
      searchUrl = `${baseUrl}?${params}`;
    }

    // Make request to external API
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MealCart/1.0'
      },
      timeout: 10000 // 10 second timeout
    });

    // Handle API response errors
    if (!response.ok) {
      console.error('Spoonacular API error:', {
        status: response.status,
        statusText: response.statusText,
        url: searchUrl
      });

      // Handle specific error cases
      if (response.status === 401) {
        return res.status(500).json({ 
          success: false,
          message: 'Recipe API authentication failed',
          error: 'API_AUTH_ERROR',
          data: []
        });
      }

      if (response.status === 402) {
        return res.status(429).json({ 
          success: false,
          message: 'Daily API quota exceeded. Please try again tomorrow.',
          error: 'API_QUOTA_EXCEEDED',
          data: []
        });
      }

      if (response.status === 429) {
        return res.status(429).json({ 
          success: false,
          message: 'Too many requests. Please wait a moment and try again.',
          error: 'API_RATE_LIMIT',
          data: []
        });
      }

      return res.status(500).json({ 
        success: false,
        message: 'Failed to fetch recipes from external service',
        error: 'EXTERNAL_API_ERROR',
        data: []
      });
    }

    const data = await response.json();

    let recipesData;
    let totalResults = 0;

    // Handle different response formats based on search type
    if (ingredients) {
      // findByIngredients returns an array directly
      recipesData = Array.isArray(data) ? data : [];
      totalResults = recipesData.length;
    } else {
      // complexSearch returns an object with results array
      recipesData = Array.isArray(data.results) ? data.results : [];
      totalResults = data.totalResults || recipesData.length;
    }

    // Handle empty results
    if (recipesData.length === 0) {
      return res.json({
        success: true,
        message: ingredients ? 
          'No recipes found with the provided ingredients' : 
          'No recipes found for the search query',
        data: [],
        pagination: {
          total: 0,
          page: Math.floor(parseInt(offset) / parseInt(number)) + 1,
          limit: parseInt(number),
          hasNextPage: false,
          hasPrevPage: parseInt(offset) > 0
        },
        searchParams: { query, ingredients, diet, intolerances, type, maxReadyTime }
      });
    }

    let processedRecipes;

    if (ingredients) {
      // For ingredient-based search, we need to fetch detailed info
      const detailedRecipes = await Promise.allSettled(
        recipesData.slice(0, parseInt(number)).map(async (recipe) => {
          try {
            const detailUrl = `https://api.spoonacular.com/recipes/${recipe.id}/information?apiKey=${process.env.SPOONACULAR_API_KEY}&includeNutrition=true`;
            const detailResponse = await fetch(detailUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'MealCart/1.0'
              },
              timeout: 10000
            });

            if (!detailResponse.ok) {
              throw new Error(`Failed to fetch recipe details: ${detailResponse.status}`);
            }

            const detailData = await detailResponse.json();

            return {
              id: recipe.id,
              title: recipe.title,
              image: recipe.image,
              imageType: recipe.imageType,
              likes: recipe.likes || 0,
              readyInMinutes: detailData.readyInMinutes || null,
              ingredients: formatIngredients(detailData.extendedIngredients || []),
              instructions: formatInstructions(detailData.instructions, detailData.analyzedInstructions),
              nutrition: formatNutrition(detailData.nutrition),
              dietaryTags: extractDietaryTags(detailData),
              difficulty: calculateDifficulty(detailData),
              usedIngredients: recipe.usedIngredients || [],
              missedIngredients: recipe.missedIngredients || [],
              spoonacularScore: detailData.spoonacularScore || 0,
              summary: cleanHtmlText(detailData.summary) || '',
              sourceUrl: detailData.sourceUrl || '',
              healthScore: detailData.healthScore || 0
            };
          } catch (error) {
            console.error(`Error fetching details for recipe ${recipe.id}:`, error.message);
            return null;
          }
        })
      );

      // Filter out failed requests and null results
      processedRecipes = detailedRecipes
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
    } else {
      // For text-based search, the response already includes detailed info
      processedRecipes = recipesData.map(recipe => ({
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        imageType: recipe.imageType || 'jpg',
        likes: recipe.aggregateLikes || 0,
        readyInMinutes: recipe.readyInMinutes || null,
        ingredients: formatIngredients(recipe.extendedIngredients || []),
        instructions: formatInstructions(recipe.instructions, recipe.analyzedInstructions),
        nutrition: formatNutrition(recipe.nutrition),
        dietaryTags: extractDietaryTags(recipe),
        difficulty: calculateDifficulty(recipe),
        spoonacularScore: recipe.spoonacularScore || 0,
        summary: cleanHtmlText(recipe.summary) || '',
        sourceUrl: recipe.sourceUrl || '',
        healthScore: recipe.healthScore || 0
      }));
    }

    // Calculate pagination info
    const currentPage = Math.floor(parseInt(offset) / parseInt(number)) + 1;
    const hasNextPage = (parseInt(offset) + parseInt(number)) < totalResults;
    const hasPrevPage = parseInt(offset) > 0;

    res.json({
      success: true,
      message: `Found ${processedRecipes.length} recipes`,
      data: processedRecipes,
      pagination: {
        total: totalResults,
        page: currentPage,
        limit: parseInt(number),
        hasNextPage,
        hasPrevPage
      },
      searchParams: { query, ingredients, diet, intolerances, type, maxReadyTime }
    });

  } catch (error) {
    console.error('Recipe search error:', error);

    // Handle network/timeout errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return res.status(503).json({ 
        success: false,
        message: 'Recipe service is temporarily unavailable. Please try again.',
        error: 'SERVICE_TIMEOUT',
        data: []
      });
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return res.status(500).json({ 
        success: false,
        message: 'Invalid response from recipe service',
        error: 'INVALID_API_RESPONSE',
        data: []
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'Internal server error during recipe search',
      error: 'INTERNAL_SERVER_ERROR',
      data: []
    });
  }
};

// Get trending/popular recipes
const getTrendingRecipes = async (req, res) => {
  try {
    const { number = 12, offset = 0 } = req.query;

    if (!process.env.SPOONACULAR_API_KEY) {
      return res.status(500).json({ 
        success: false,
        message: 'Recipe API service is currently unavailable',
        error: 'API_SERVICE_UNAVAILABLE',
        data: []
      });
    }

    const baseUrl = 'https://api.spoonacular.com/recipes/random';
    const params = new URLSearchParams({
      apiKey: process.env.SPOONACULAR_API_KEY,
      number: Math.min(parseInt(number), 50),
      tags: 'healthy,quick'
    });

    const response = await fetch(`${baseUrl}?${params}`, {
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const recipes = data.recipes || [];

    const formattedRecipes = recipes.map(recipe => ({
      id: recipe.id.toString(),
      externalId: recipe.id.toString(),
      name: recipe.title,
      image: recipe.image,
      description: cleanHtmlText(recipe.summary),
      servings: recipe.servings,
      readyInMinutes: recipe.readyInMinutes,
      ingredients: formatIngredients(recipe.extendedIngredients || []),
      instructions: formatInstructions(recipe.instructions, recipe.analyzedInstructions),
      dietaryTags: extractDietaryTags(recipe),
      spoonacularScore: recipe.spoonacularScore || 0
    }));

    res.json({
      success: true,
      message: `Found ${formattedRecipes.length} trending recipes`,
      data: formattedRecipes,
      pagination: {
        total: formattedRecipes.length,
        page: 1,
        limit: parseInt(number),
        hasNextPage: false,
        hasPrevPage: false
      }
    });

  } catch (error) {
    console.error('Trending recipes error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch trending recipes',
      error: 'INTERNAL_SERVER_ERROR',
      data: []
    });
  }
};

// Helper functions
function cleanHtmlText(htmlText) {
  if (!htmlText) return '';
  return htmlText
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .trim();
}

function formatIngredients(ingredients) {
  if (!Array.isArray(ingredients)) return [];
  
  return ingredients.map(ingredient => ({
    id: ingredient.id,
    name: ingredient.nameClean || ingredient.name || 'Unknown ingredient',
    amount: ingredient.amount || 0,
    unit: ingredient.unit || '',
    originalText: ingredient.original || '',
    image: ingredient.image ? `https://img.spoonacular.com/ingredients_100x100/${ingredient.image}` : null
  }));
}

function formatInstructions(instructions, analyzedInstructions) {
  if (Array.isArray(analyzedInstructions) && analyzedInstructions.length > 0) {
    return analyzedInstructions[0].steps.map((step, index) => ({
      number: step.number || index + 1,
      step: cleanHtmlText(step.step)
    }));
  }
  
  if (typeof instructions === 'string') {
    return [{
      number: 1,
      step: cleanHtmlText(instructions)
    }];
  }
  
  return [{
    number: 1,
    step: 'No instructions available'
  }];
}

function formatNutrition(nutrition) {
  if (!nutrition || !nutrition.nutrients) {
    return {
      calories: null,
      protein: null,
      carbohydrates: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null
    };
  }

  const nutrients = nutrition.nutrients;
  return {
    calories: findNutrient(nutrients, 'Calories')?.amount || null,
    protein: findNutrient(nutrients, 'Protein')?.amount || null,
    carbohydrates: findNutrient(nutrients, 'Carbohydrates')?.amount || null,
    fat: findNutrient(nutrients, 'Fat')?.amount || null,
    fiber: findNutrient(nutrients, 'Fiber')?.amount || null,
    sugar: findNutrient(nutrients, 'Sugar')?.amount || null,
    sodium: findNutrient(nutrients, 'Sodium')?.amount || null
  };
}

function findNutrient(nutrients, name) {
  return nutrients.find(nutrient => 
    nutrient.name === name || 
    nutrient.title === name ||
    nutrient.name?.toLowerCase().includes(name.toLowerCase())
  );
}

function extractDietaryTags(recipe) {
  const tags = [];
  
  if (recipe.vegetarian) tags.push('Vegetarian');
  if (recipe.vegan) tags.push('Vegan');
  if (recipe.glutenFree) tags.push('Gluten-Free');
  if (recipe.dairyFree) tags.push('Dairy-Free');
  if (recipe.veryHealthy) tags.push('Healthy');
  if (recipe.cheap) tags.push('Budget-Friendly');
  if (recipe.veryPopular) tags.push('Popular');
  if (recipe.sustainable) tags.push('Sustainable');
  if (recipe.ketogenic) tags.push('Keto');
  if (recipe.whole30) tags.push('Whole30');
  
  // Add cuisine tags
  if (recipe.cuisines && Array.isArray(recipe.cuisines)) {
    tags.push(...recipe.cuisines);
  }
  
  // Add dish type tags
  if (recipe.dishTypes && Array.isArray(recipe.dishTypes)) {
    tags.push(...recipe.dishTypes.map(type => 
      type.charAt(0).toUpperCase() + type.slice(1)
    ));
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

function calculateDifficulty(recipe) {
  let score = 0;
  
  // Factor in ready time
  const readyTime = recipe.readyInMinutes || 0;
  if (readyTime <= 15) score += 1;
  else if (readyTime <= 30) score += 2;
  else if (readyTime <= 60) score += 3;
  else score += 4;
  
  // Factor in number of ingredients
  const ingredientCount = recipe.extendedIngredients?.length || 0;
  if (ingredientCount <= 5) score += 1;
  else if (ingredientCount <= 10) score += 2;
  else if (ingredientCount <= 15) score += 3;
  else score += 4;
  
  // Factor in number of steps
  const stepCount = recipe.analyzedInstructions?.[0]?.steps?.length || 1;
  if (stepCount <= 3) score += 1;
  else if (stepCount <= 6) score += 2;
  else if (stepCount <= 10) score += 3;
  else score += 4;
  
  // Convert to difficulty level
  if (score <= 4) return 'Easy';
  else if (score <= 8) return 'Medium';
  else return 'Hard';
}

module.exports = {
  searchRecipes,
  getTrendingRecipes
};
