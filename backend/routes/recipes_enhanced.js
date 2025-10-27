const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const imageService = require('../services/imageService');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// GET /api/recipes - Get all recipes with pagination and filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    // Build filter query
    let filterQuery = { isPublic: true };
    
    // Dietary filters
    if (req.query.dietary) {
      const dietaryTags = req.query.dietary.split(',');
      filterQuery.dietaryTags = { $in: dietaryTags };
    }
    
    // Cuisine filter
    if (req.query.cuisine) {
      filterQuery.cuisine = { $regex: req.query.cuisine, $options: 'i' };
    }
    
    // Difficulty filter
    if (req.query.difficulty) {
      filterQuery.difficulty = req.query.difficulty;
    }
    
    // Category filter
    if (req.query.category) {
      filterQuery.category = req.query.category;
    }
    
    // Cooking time filter
    if (req.query.maxTime) {
      filterQuery.cookingTime = { $lte: parseInt(req.query.maxTime) };
    }
    
    // Search query
    if (req.query.search) {
      filterQuery.$text = { $search: req.query.search };
    }
    
    // Ingredient-based search
    if (req.query.ingredients) {
      const ingredients = req.query.ingredients.split(',');
      filterQuery['ingredients.name'] = { 
        $in: ingredients.map(ing => new RegExp(ing.trim(), 'i'))
      };
    }
    
    // Sort options
    let sortQuery = {};
    switch (req.query.sort) {
      case 'rating':
        sortQuery = { averageRating: -1 };
        break;
      case 'time':
        sortQuery = { cookingTime: 1 };
        break;
      case 'newest':
        sortQuery = { createdAt: -1 };
        break;
      case 'popular':
        sortQuery = { totalRatings: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }
    
    const recipes = await Recipe.find(filterQuery)
      .populate('userId', 'username profileImage')
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalRecipes = await Recipe.countDocuments(filterQuery);
    const totalPages = Math.ceil(totalRecipes / limit);
    
    res.json({
      success: true,
      data: {
        recipes,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecipes,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recipes',
      error: error.message
    });
  }
});

// GET /api/recipes/my-recipes - Get current user's own recipes (both public and private)
router.get('/my-recipes', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    // Get all user's recipes regardless of public status
    const recipes = await Recipe.find({ 
      userId: req.user.id
    })
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalRecipes = await Recipe.countDocuments({ 
      userId: req.user.id
    });
    
    res.json({
      success: true,
      data: {
        recipes,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRecipes / limit),
          totalRecipes,
          hasNext: page < Math.ceil(totalRecipes / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching my recipes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your recipes',
      error: error.message
    });
  }
});

// GET /api/recipes/:id - Get single recipe
router.get('/:id', async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate('userId', 'username profileImage bio followerCount')
      .populate('ratings.user', 'username profileImage');
    
    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }
    
    res.json({
      success: true,
      data: recipe
    });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recipe',
      error: error.message
    });
  }
});

// POST /api/recipes - Create new recipe (requires authentication)
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      name,
      description,
      ingredients,
      instructions,
      cookingTime,
      prepTime,
      servings,
      difficulty,
      cuisine,
      dietaryTags,
      images,
      category,
      tags
    } = req.body;
    
    // Use title or name for the recipe name
    const recipeName = name || title;
    
    // Validate required fields
    if (!recipeName || !ingredients || !instructions) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, ingredients, and instructions are required'
      });
    }
    
    // Convert instructions array to string if needed
    let instructionsString = instructions;
    if (Array.isArray(instructions)) {
      instructionsString = instructions
        .map((inst, index) => `${index + 1}. ${inst.instruction || inst}`)
        .join('\n');
    }
    
    // Generate unique external ID
    const externalId = `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Convert ingredients to match the model structure
    const processedIngredients = ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount?.toString() || '1',
      unit: ing.unit || '',
      original: ing.original || `${ing.amount || ''} ${ing.unit || ''} ${ing.name}`.trim()
    }));
    
    const recipe = new Recipe({
      externalId,
      name: recipeName,
      description: description || '',
      ingredients: processedIngredients,
      instructions: instructionsString,
      cookingTime: cookingTime || 0,
      preparationTime: prepTime || 0,
      servings: servings || 1,
      difficulty: difficulty || 'medium',
      dietaryTags: dietaryTags || [],
      userId: req.user.id,
      isPublic: false  // AI recipes start as private, user can make public later
    });
    
    await recipe.save();
    
    // Add recipe to user's created recipes (if the field exists in User model)
    try {
      await User.findByIdAndUpdate(req.user.id, {
        $push: { createdRecipes: recipe._id }
      });
    } catch (userUpdateError) {
      console.log('Note: Could not update user createdRecipes array:', userUpdateError.message);
    }
    
    const populatedRecipe = await Recipe.findById(recipe._id)
      .populate('userId', 'username email');
    
    res.status(201).json({
      success: true,
      data: populatedRecipe,
      message: 'Recipe created successfully'
    });
  } catch (error) {
    console.error('Error creating recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating recipe',
      error: error.message
    });
  }
});

// PUT /api/recipes/:id - Update recipe (requires authentication and ownership)
router.put('/:id', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }
    
    // Check if user owns the recipe
    if (recipe.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this recipe'
      });
    }
    
    // Update recipe
    Object.assign(recipe, req.body);
    await recipe.save();
    
    const updatedRecipe = await Recipe.findById(recipe._id)
      .populate('userId', 'username profileImage');
    
    res.json({
      success: true,
      data: updatedRecipe,
      message: 'Recipe updated successfully'
    });
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating recipe',
      error: error.message
    });
  }
});

// DELETE /api/recipes/:id - Delete recipe (requires authentication and ownership)
router.delete('/:id', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }
    
    // Check if user owns the recipe
    if (recipe.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this recipe'
      });
    }
    
    await Recipe.findByIdAndDelete(req.params.id);
    
    // Remove recipe from user's created recipes
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { createdRecipes: req.params.id }
    });
    
    // Remove from all users' favorites
    await User.updateMany(
      { favoriteRecipes: req.params.id },
      { $pull: { favoriteRecipes: req.params.id } }
    );
    
    res.json({
      success: true,
      message: 'Recipe deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting recipe',
      error: error.message
    });
  }
});

// POST /api/recipes/:id/rate - Rate a recipe
router.post('/:id/rate', auth, async (req, res) => {
  try {
    const { rating, review } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }
    
    const recipe = await Recipe.findById(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }
    
    // Check if user already rated this recipe
    const existingRatingIndex = recipe.ratings.findIndex(
      r => r.user.toString() === req.user.id
    );
    
    if (existingRatingIndex !== -1) {
      // Update existing rating
      recipe.ratings[existingRatingIndex].rating = rating;
      recipe.ratings[existingRatingIndex].review = review || '';
    } else {
      // Add new rating
      recipe.ratings.push({
        user: req.user.id,
        rating,
        review: review || ''
      });
    }
    
    await recipe.save();
    
    res.json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        averageRating: recipe.averageRating,
        totalRatings: recipe.totalRatings
      }
    });
  } catch (error) {
    console.error('Error rating recipe:', error);
    res.status(500).json({
      success: false,
      message: 'Error rating recipe',
      error: error.message
    });
  }
});

// POST /api/recipes/:id/favorite - Toggle favorite recipe
router.post('/:id/favorite', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }
    
    const user = await User.findById(req.user.id);
    const isFavorited = user.favoriteRecipes.includes(req.params.id);
    
    if (isFavorited) {
      // Remove from favorites
      user.favoriteRecipes.pull(req.params.id);
    } else {
      // Add to favorites
      user.favoriteRecipes.push(req.params.id);
    }
    
    await user.save();
    
    res.json({
      success: true,
      message: isFavorited ? 'Recipe removed from favorites' : 'Recipe added to favorites',
      data: { isFavorited: !isFavorited }
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling favorite',
      error: error.message
    });
  }
});

// GET /api/recipes/user/:userId - Get recipes by user
router.get('/user/:userId', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    
    const recipes = await Recipe.find({ 
      userId: req.params.userId,
      isPublic: true 
    })
      .populate('userId', 'username profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const totalRecipes = await Recipe.countDocuments({ 
      userId: req.params.userId,
      isPublic: true 
    });
    
    res.json({
      success: true,
      data: {
        recipes,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRecipes / limit),
          totalRecipes
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user recipes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user recipes',
      error: error.message
    });
  }
});

// POST /api/recipes-enhanced/:id/fetch-image - Fetch image for a recipe
router.post('/:id/fetch-image', auth, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id);
    
    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found'
      });
    }

    console.log(`Fetching image for recipe: "${recipe.name}" (ID: ${recipe._id})`);

    // Check if recipe already has an image
    if (recipe.image && recipe.image.trim() !== '') {
      console.log(`Recipe "${recipe.name}" already has image: ${recipe.image}`);
      return res.json({
        success: true,
        message: 'Recipe already has an image',
        data: {
          image: recipe.image,
          recipeName: recipe.name,
          source: 'existing'
        }
      });
    }

    // Search for an image
    console.log(`Searching for image for recipe: "${recipe.name}", cuisine: "${recipe.cuisine || 'unknown'}"`);
    const imageUrl = await imageService.searchRecipeImage(
      recipe.name, 
      recipe.cuisine || ''
    );

    if (!imageUrl) {
      console.error(`Failed to find image for recipe: "${recipe.name}"`);
      return res.status(500).json({
        success: false,
        message: 'Failed to find suitable image for recipe'
      });
    }

    // Update the recipe with the new image
    recipe.image = imageUrl;
    await recipe.save();

    console.log(`Successfully updated recipe "${recipe.name}" with image: ${imageUrl}`);

    res.json({
      success: true,
      message: 'Image fetched and updated successfully',
      data: {
        image: imageUrl,
        recipeName: recipe.name,
        cuisine: recipe.cuisine,
        source: 'fetched'
      }
    });

  } catch (error) {
    console.error('Error fetching recipe image:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching recipe image',
      error: error.message
    });
  }
});

// POST /api/recipes-enhanced/batch-fetch-images - Fetch images for multiple recipes
router.post('/batch-fetch-images', auth, async (req, res) => {
  try {
    const { recipeIds, force = false } = req.body;

    if (!recipeIds || !Array.isArray(recipeIds)) {
      return res.status(400).json({
        success: false,
        message: 'Recipe IDs array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const recipeId of recipeIds) {
      try {
        const recipe = await Recipe.findById(recipeId);
        
        if (!recipe) {
          errors.push({ recipeId, error: 'Recipe not found' });
          continue;
        }

        // Skip if recipe already has image (unless force is true)
        if (!force && recipe.image && recipe.image.trim() !== '') {
          results.push({ 
            recipeId, 
            recipeName: recipe.name,
            image: recipe.image, 
            status: 'already_has_image' 
          });
          continue;
        }

        // Search for an image
        const imageUrl = await imageService.searchRecipeImage(
          recipe.name, 
          recipe.cuisine || ''
        );

        // Update the recipe with the new image
        recipe.image = imageUrl;
        await recipe.save();

        results.push({ 
          recipeId, 
          recipeName: recipe.name,
          image: imageUrl, 
          status: 'image_fetched' 
        });

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        errors.push({ recipeId, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${recipeIds.length} recipes`,
      data: {
        results,
        errors,
        summary: {
          total: recipeIds.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error) {
    console.error('Error in batch image fetch:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching images for recipes',
      error: error.message
    });
  }
});

module.exports = router;
