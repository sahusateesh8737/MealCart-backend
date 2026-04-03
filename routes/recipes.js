const express = require('express');
const Recipe = require('../models/Recipe');
const { auth } = require('../middleware/auth');
const { searchRecipes, getTrendingRecipes } = require('../controllers/recipeController');
const { logger } = require('../utils/logger');

const router = express.Router();

// Debug endpoint - Get saved recipes for logged-in user (simpler version)
router.get('/my-recipes', auth, async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.user._id);

    // Handle limit properly: if limit=0, fetch all; otherwise use provided limit or default to 100
    let limit = req.query.limit !== undefined ? parseInt(req.query.limit) : 100;
    if (limit === 0) {
      limit = 10000; // Effectively "all" - set to very large number
    }

    console.log(`[My Recipes] Request from user: ${userId} (Original: ${req.user._id})`);

    const recipes = await Recipe.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('userId', 'username email');

    console.log(`[My Recipes] Found ${recipes.length} recipes for user ${userId}`);

    res.json({
      success: true,
      count: recipes.length,
      recipes,
      userId: userId.toString(),
    });
  } catch (error) {
    console.error('[My Recipes] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching recipes',
      error: error.message,
    });
  }
});

// Search recipes using external Food API (Spoonacular) - Updated to use controller
router.get('/search', searchRecipes);

// Search recipes by ingredients - also uses the same controller
router.get('/search-by-ingredients', searchRecipes);

// Get trending/popular recipes
router.get('/trending', getTrendingRecipes);

// REMOVED: Duplicate favorites endpoint - use /api/users/favorites instead
// This duplicate was causing response conflicts with the main favorites endpoint in users.js

// POST /api/recipes - Create/save a new recipe (alias to /save for frontend compatibility)
router.post('/', auth, async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      externalId,
      name,
      image,
      description,
      ingredients,
      instructions,
      cookingTime,
      preparationTime,
      servings,
      difficulty,
      dietaryTags,
      nutrition,
    } = req.body;

    logger.logUserActivity('RECIPE_CREATE_ATTEMPT', req, req.user._id, {
      recipeName: name,
      externalId,
      ingredientsCount: ingredients?.length,
      difficulty,
      servings,
      hasNutrition: !!nutrition,
    });

    // Validation
    if (!name || !instructions) {
      logger.warn('Recipe creation failed - missing required fields', {
        userId: req.user._id,
        hasName: !!name,
        hasInstructions: !!instructions,
      });
      return res.status(400).json({
        success: false,
        message: 'Recipe name and instructions are required',
        error: 'MISSING_REQUIRED_FIELDS',
      });
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      logger.warn('Recipe creation failed - missing ingredients', {
        userId: req.user._id,
        recipeName: name,
        isArray: Array.isArray(ingredients),
        ingredientsLength: ingredients?.length,
      });
      return res.status(400).json({
        success: false,
        message: 'At least one ingredient is required',
        error: 'MISSING_INGREDIENTS',
      });
    }

    // Convert ingredients from strings to objects if needed
    const formattedIngredients = ingredients.map((ing) => {
      if (typeof ing === 'string') {
        return {
          name: ing,
          amount: '',
          unit: '',
          original: ing,
        };
      }
      return {
        name: ing.name || ing.original || '',
        amount: ing.amount || '',
        unit: ing.unit || '',
        original: ing.original || ing.name || '',
      };
    });

    // Convert instructions from array to string if needed
    const formattedInstructions = Array.isArray(instructions)
      ? instructions.join('\n')
      : instructions;

    // Normalize difficulty to lowercase
    const normalizedDifficulty = difficulty ? difficulty.toLowerCase() : 'medium';

    // Check if recipe already exists (if externalId provided)
    if (externalId) {
      const existingRecipe = await Recipe.findOne({
        externalId,
        userId: req.user._id,
      });

      if (existingRecipe) {
        logger.warn('Recipe creation failed - already exists', {
          userId: req.user._id,
          recipeName: name,
          externalId,
          existingRecipeId: existingRecipe._id,
        });
        return res.status(400).json({
          success: false,
          message: 'Recipe already saved',
          error: 'RECIPE_ALREADY_EXISTS',
          recipe: existingRecipe,
        });
      }
    }

    // Create new recipe
    const recipe = new Recipe({
      externalId: externalId || `user_${req.user._id}_${Date.now()}`,
      name,
      image: image || '',
      description: description || '',
      ingredients: formattedIngredients,
      instructions: formattedInstructions,
      cookingTime: cookingTime || 0,
      preparationTime: preparationTime || 0,
      servings: servings || 1,
      difficulty: normalizedDifficulty,
      dietaryTags: dietaryTags || [],
      nutrition: nutrition || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      },
      userId: req.user._id,
      source: 'user_created',
      isAIGenerated: false,
    });

    await recipe.save();

    const duration = Date.now() - startTime;
    logger.logUserActivity('RECIPE_CREATED', req, req.user._id, {
      recipeId: recipe._id,
      recipeName: name,
      externalId: recipe.externalId,
      duration,
      ingredientsCount: ingredients.length,
      instructionsCount: instructions.length,
    });

    console.log(`Recipe created successfully: ${recipe._id} (${duration}ms)`);

    res.status(201).json({
      success: true,
      message: 'Recipe created successfully',
      recipe,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Recipe creation error', error, {
      userId: req.user?._id,
      recipeName: req.body?.name,
      duration,
      stack: error.stack,
    });

    console.error('Error creating recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating recipe',
      error: error.message,
    });
  }
});

// Save a recipe to MongoDB
router.post('/save', auth, async (req, res) => {
  const startTime = Date.now();
  try {
    const {
      externalId,
      name,
      title, // Frontend might send 'title' instead of 'name'
      image,
      description,
      ingredients,
      instructions,
      cookingTime,
      preparationTime,
      servings,
      difficulty,
      dietaryTags,
      nutrition,
    } = req.body;

    // Use 'name' or 'title' - whichever is provided
    const recipeName = name || title;

    logger.logUserActivity('RECIPE_SAVE_ATTEMPT', req, req.user._id, {
      recipeName,
      externalId,
      ingredientsCount: ingredients?.length,
      difficulty,
      servings,
      hasNutrition: !!nutrition,
    });

    // Validation
    if (!externalId || !recipeName || !instructions) {
      logger.warn('Recipe save failed - missing required fields', {
        userId: req.user._id,
        hasExternalId: !!externalId,
        hasName: !!recipeName,
        hasInstructions: !!instructions,
        receivedFields: Object.keys(req.body),
      });
      return res.status(400).json({
        success: false,
        message: 'External ID, recipe name (or title), and instructions are required',
        error: 'MISSING_REQUIRED_FIELDS',
        details: {
          externalId: !!externalId,
          name: !!recipeName,
          instructions: !!instructions,
          receivedFields: Object.keys(req.body),
        },
      });
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      logger.warn('Recipe save failed - missing ingredients', {
        userId: req.user._id,
        recipeName,
        isArray: Array.isArray(ingredients),
        ingredientsLength: ingredients?.length,
      });
      return res.status(400).json({
        success: false,
        message: 'At least one ingredient is required',
        error: 'MISSING_INGREDIENTS',
      });
    }

    // Check if recipe already saved by this user
    const existingRecipe = await Recipe.findOne({
      externalId,
      userId: req.user._id,
    });

    if (existingRecipe) {
      logger.warn('Recipe save failed - already saved', {
        userId: req.user._id,
        recipeName,
        externalId,
        existingRecipeId: existingRecipe._id,
      });
      return res.status(400).json({
        success: false,
        message: 'Recipe already saved',
        error: 'RECIPE_ALREADY_SAVED',
        recipe: existingRecipe,
      });
    }

    // Convert ingredients to proper format if needed
    const formattedIngredients = ingredients.map((ing) => {
      if (typeof ing === 'string') {
        return {
          name: ing,
          amount: '',
          unit: '',
          original: ing,
        };
      }
      return {
        name: ing.name || ing.original || '',
        amount: ing.amount || '',
        unit: ing.unit || '',
        original: ing.original || ing.name || '',
      };
    });

    // Convert instructions to string if it's an array
    const formattedInstructions = Array.isArray(instructions)
      ? instructions.join('\n')
      : instructions;

    // Create new recipe
    const recipe = new Recipe({
      externalId,
      name: recipeName,
      image: image || '',
      description: description || '',
      ingredients: formattedIngredients,
      instructions: formattedInstructions,
      userId: req.user._id,
      cookingTime: cookingTime || null,
      preparationTime: preparationTime || null,
      servings: servings || 1,
      difficulty: difficulty ? difficulty.toLowerCase() : 'medium',
      dietaryTags: dietaryTags || [],
      nutrition: nutrition || {},
      source: 'external_api',
      isAIGenerated: false,
    });

    await recipe.save();
    await recipe.populate('userId', 'username email');

    const processingTime = Date.now() - startTime;
    logger.logUserActivity('RECIPE_SAVE_SUCCESS', req, req.user._id, {
      recipeName,
      recipeId: recipe._id,
      externalId,
      ingredientsCount: ingredients.length,
      difficulty,
      servings,
      processingTime: `${processingTime}ms`,
    });

    res.status(201).json({
      success: true,
      message: 'Recipe saved successfully',
      recipe,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.logError(error, req, {
      action: 'RECIPE_SAVE',
      userId: req.user?._id,
      processingTime: `${processingTime}ms`,
      recipeName: req.body.name || req.body.title,
    });

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors,
        error: 'VALIDATION_ERROR',
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Recipe with this external ID already exists',
        error: 'DUPLICATE_RECIPE',
      });
    }

    res.status(500).json({
      message: 'Server error while saving recipe',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Get all saved recipes for a user
router.get('/saved/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, sortBy = 'createdAt', order = 'desc' } = req.query;

    console.log('[Saved Recipes] Request:', {
      paramUserId: userId,
      authUserId: req.user._id.toString(),
      page,
      limit,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
    });

    // Ensure user can only access their own recipes
    if (userId !== req.user._id.toString()) {
      console.warn('[Saved Recipes] Access denied - userId mismatch');
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own recipes.',
        error: 'ACCESS_DENIED',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    const recipes = await Recipe.find({ userId })
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username email');

    const totalRecipes = await Recipe.countDocuments({ userId });

    console.log('[Saved Recipes] Found:', {
      totalRecipes,
      returnedCount: recipes.length,
      page: parseInt(page),
    });

    res.json({
      success: true,
      recipes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalRecipes / parseInt(limit)),
        totalRecipes,
        hasNextPage: skip + recipes.length < totalRecipes,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error('Get saved recipes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching saved recipes',
      error: 'INTERNAL_SERVER_ERROR',
      details: error.message,
    });
  }
});

// Standard DELETE /:id route
router.delete('/:id', auth, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user._id;

    const recipe = await Recipe.findOne({
      _id: recipeId,
      userId: userId,
    });

    if (!recipe) {
      return res.status(404).json({
        message: 'Recipe not found or you are not authorized to delete it',
        error: 'RECIPE_NOT_FOUND',
      });
    }

    await Recipe.findByIdAndDelete(recipeId);

    res.json({
      success: true,
      message: 'Recipe deleted successfully',
      deletedRecipeId: recipeId,
    });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({
      message: 'Server error while deleting recipe',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Delete a saved recipe (Legacy route support)
router.delete('/delete/:userId/:recipeId', auth, async (req, res) => {
  try {
    const { userId, recipeId } = req.params;

    // Ensure user can only delete their own recipes
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied. You can only delete your own recipes.',
        error: 'ACCESS_DENIED',
      });
    }

    const recipe = await Recipe.findOne({
      _id: recipeId,
      userId: req.user._id,
    });

    if (!recipe) {
      return res.status(404).json({
        message: 'Recipe not found',
        error: 'RECIPE_NOT_FOUND',
      });
    }

    await Recipe.findByIdAndDelete(recipeId);

    res.json({
      message: 'Recipe deleted successfully',
      deletedRecipe: {
        id: recipe._id,
        name: recipe.name,
      },
    });
  } catch (error) {
    console.error('Delete recipe error:', error);
    res.status(500).json({
      message: 'Server error while deleting recipe',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Search saved recipes by name for a specific user
router.get('/saved/search/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, page = 1, limit = 10 } = req.query;

    // Ensure user can only search their own recipes
    if (userId !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied. You can only search your own recipes.',
        error: 'ACCESS_DENIED',
      });
    }

    if (!name) {
      return res.status(400).json({
        message: 'Search query (name) is required',
        error: 'MISSING_SEARCH_QUERY',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const searchRegex = new RegExp(name, 'i');
    const recipes = await Recipe.find({
      userId,
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { 'ingredients.name': searchRegex },
      ],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'username email');

    const totalResults = await Recipe.countDocuments({
      userId,
      $or: [
        { name: searchRegex },
        { description: searchRegex },
        { 'ingredients.name': searchRegex },
      ],
    });

    res.json({
      recipes,
      searchQuery: name,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalResults / parseInt(limit)),
        totalResults,
        hasNextPage: skip + recipes.length < totalResults,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error('Search saved recipes error:', error);
    res.status(500).json({
      message: 'Server error while searching saved recipes',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Update recipe (rating, notes, favorite status)
router.patch('/update/:recipeId', auth, async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { rating, notes, isFavorite } = req.body;

    const recipe = await Recipe.findOne({
      _id: recipeId,
      userId: req.user._id,
    });

    if (!recipe) {
      return res.status(404).json({
        message: 'Recipe not found',
        error: 'RECIPE_NOT_FOUND',
      });
    }

    // Update fields if provided
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return res.status(400).json({
          message: 'Rating must be between 1 and 5',
          error: 'INVALID_RATING',
        });
      }
      recipe.rating = rating;
    }

    if (notes !== undefined) {
      recipe.notes = notes;
    }

    if (isFavorite !== undefined) {
      recipe.isFavorite = isFavorite;
    }

    await recipe.save();

    res.json({
      message: 'Recipe updated successfully',
      recipe,
    });
  } catch (error) {
    console.error('Update recipe error:', error);
    res.status(500).json({
      message: 'Server error while updating recipe',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Mark recipe as cooked
router.post('/cooked/:recipeId', auth, async (req, res) => {
  try {
    const { recipeId } = req.params;

    const recipe = await Recipe.findOne({
      _id: recipeId,
      userId: req.user._id,
    });

    if (!recipe) {
      return res.status(404).json({
        message: 'Recipe not found',
        error: 'RECIPE_NOT_FOUND',
      });
    }

    await recipe.markAsCooked();

    res.json({
      message: 'Recipe marked as cooked',
      recipe: {
        id: recipe._id,
        name: recipe.name,
        timesCooked: recipe.timesCooked,
        lastCooked: recipe.lastCooked,
      },
    });
  } catch (error) {
    console.error('Mark recipe as cooked error:', error);
    res.status(500).json({
      message: 'Server error while marking recipe as cooked',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Rate a recipe
router.post('/:recipeId/rate', auth, async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        message: 'Valid rating between 1 and 5 is required',
        error: 'INVALID_RATING',
      });
    }

    const recipe = await Recipe.findOne({
      _id: recipeId,
      userId: req.user._id,
    });

    if (!recipe) {
      return res.status(404).json({
        message: 'Recipe not found',
        error: 'RECIPE_NOT_FOUND',
      });
    }

    recipe.rating = rating;
    if (review) {
      recipe.notes = review;
    }

    await recipe.save();

    res.json({
      message: 'Rating submitted successfully',
      recipe: {
        id: recipe._id,
        rating: recipe.rating,
        notes: recipe.notes,
      },
    });
  } catch (error) {
    console.error('Rate recipe error:', error);
    res.status(500).json({
      message: 'Server error while rating recipe',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

module.exports = router;
