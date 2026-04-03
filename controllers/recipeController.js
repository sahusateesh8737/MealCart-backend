const Recipe = require('../models/Recipe');

// Search recipes (Internal/Local only now)
const searchRecipes = async (req, res) => {
  try {
    const {
      query,
      ingredients,
      number = 12,
      offset = 0,
      diet,
      intolerances,
      type,
      maxReadyTime,
    } = req.query;

    // Local Database Search Implementation
    // Build the query object
    const queryObj = { isPublic: true }; // Only return public recipes by default unless user owns them

    // Text-based search (Name/Title)
    if (query) {
      queryObj.name = { $regex: query.toString(), $options: 'i' };
    }

    // Ingredient-based search
    if (ingredients) {
      const ingredientList = ingredients
        .toString()
        .split(',')
        .map((i) => i.trim());
      // Find recipes that contain at least one of the specified ingredients
      queryObj['ingredients.name'] = {
        $in: ingredientList.map((ing) => new RegExp(ing, 'i')),
      };
    }

    // Additional filters
    if (type) {
      queryObj.mealType = { $in: [type] };
    }

    // Pagination
    const limit = Math.min(parseInt(number), 50);
    const skip = parseInt(offset);

    // Execute query
    const totalResults = await Recipe.countDocuments(queryObj);
    const recipesData = await Recipe.find(queryObj).sort({ createdAt: -1 }).skip(skip).limit(limit);

    // Map database recipes to expected format
    const processedRecipes = recipesData.map((recipe) => ({
      id: recipe._id.toString(),
      title: recipe.name,
      likes: recipe.likes || 0,
      readyInMinutes: recipe.cookingTime + (recipe.preparationTime || 0),
      ingredients: recipe.ingredients || [],
      instructions: [
        {
          number: 1,
          step: recipe.instructions || 'No instructions available',
        },
      ],
      nutrition: recipe.nutrition || {},
      dietaryTags: recipe.dietaryTags || [],
      difficulty: recipe.difficulty || 'medium',
      summary: recipe.description || '',
      sourceUrl: '', // Internal
      image: null, // Add image if you have an image field
    }));

    // Calculate pagination info
    const currentPage = Math.floor(skip / limit) + 1;
    const hasNextPage = skip + limit < totalResults;
    const hasPrevPage = skip > 0;

    res.json({
      success: true,
      message: `Found ${processedRecipes.length} recipes in local database`,
      data: processedRecipes,
      pagination: {
        total: totalResults,
        page: currentPage,
        limit: limit,
        hasNextPage,
        hasPrevPage,
      },
      searchParams: { query, ingredients, diet, intolerances, type, maxReadyTime },
    });
  } catch (error) {
    console.error('Recipe search error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during recipe search',
      error: 'INTERNAL_SERVER_ERROR',
      data: [],
    });
  }
};

// Get trending/popular recipes (Internal/Local only now)
const getTrendingRecipes = async (req, res) => {
  try {
    // Return empty result for now
    res.json({
      success: true,
      message: 'Trending recipes feature is currently disabled.',
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 12,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });
  } catch (error) {
    console.error('Trending recipes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending recipes',
      error: 'INTERNAL_SERVER_ERROR',
      data: [],
    });
  }
};

// Save a recipe to the database
const saveRecipe = async (req, res) => {
  try {
    const { recipeData } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!recipeData) {
      return res.status(400).json({
        success: false,
        message: 'Recipe data is required',
      });
    }

    // Check if user is authenticated - recipes can only be saved for authenticated users
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to save recipes',
      });
    }

    // Check if this is a temporary ID that needs to be saved
    const isTempId = recipeData.id && recipeData.id.toString().startsWith('temp_');

    // If it's not a temporary ID and user is logged in, check if the recipe already exists for this user
    if (!isTempId && recipeData.id && userId) {
      const existingRecipe = await Recipe.findOne({
        $or: [{ _id: recipeData.id }, { externalId: recipeData.id.toString() }],
      });

      if (existingRecipe) {
        return res.json({
          success: true,
          message: 'Recipe already exists in the database',
          recipeId: existingRecipe._id,
          recipe: existingRecipe,
        });
      }
    }

    // Create a new recipe entry
    const newRecipe = new Recipe({
      externalId: recipeData.externalId || recipeData.id || `manual_${Date.now()} `,
      name: recipeData.name || recipeData.title || 'Untitled Recipe',
      description: recipeData.description || '',
      ingredients: Array.isArray(recipeData.ingredients)
        ? recipeData.ingredients.map((ingredient) => {
            if (typeof ingredient === 'string') {
              return {
                name: ingredient,
                amount: '1',
                unit: 'item',
                original: ingredient,
              };
            }
            return {
              name: ingredient.name || ingredient.ingredient || '',
              amount: ingredient.amount || '1',
              unit: ingredient.unit || 'item',
              original: ingredient.original || ingredient.name || ingredient.ingredient || '',
            };
          })
        : [],
      instructions: Array.isArray(recipeData.instructions)
        ? recipeData.instructions
            .map((step) => {
              if (typeof step === 'object' && step.instruction) {
                return step.instruction;
              }
              return step.toString();
            })
            .join('\n')
        : recipeData.instructions || 'No instructions provided',
      cookingTime: recipeData.cookingTime || recipeData.readyInMinutes || 30,
      preparationTime: recipeData.prepTime || recipeData.preparationTime || 15,
      difficulty: recipeData.difficulty || 'medium',
      cuisine: recipeData.cuisine || 'International',
      servings: recipeData.servings || 4,
      userId: userId,
      isPublic: false,
      source: recipeData.source || (recipeData.isAIGenerated ? 'ai_generation' : 'user_created'),
      isAIGenerated: recipeData.isAIGenerated || false,
      searchQuery: recipeData.searchQuery || '',
      groceryList: recipeData.groceryList || [],
      createdAt: new Date(),
    });

    // Save the recipe
    const savedRecipe = await newRecipe.save();

    console.log(`Recipe saved with ID ${savedRecipe._id} `);

    res.json({
      success: true,
      message: 'Recipe successfully saved to database',
      recipeId: savedRecipe._id,
      recipe: savedRecipe,
    });
  } catch (error) {
    console.error('Error saving recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving recipe to database',
      error: error.message,
    });
  }
};

module.exports = {
  searchRecipes,
  getTrendingRecipes,
  saveRecipe,
};
