const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const { auth } = require('../middleware/auth');
const { logger } = require('../utils/logger');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Helper function to handle temporary recipe conversion
const convertTemporaryRecipe = async (tempId, recipeData, userId) => {
  logger.debug('Converting temporary recipe to permanent', {
    tempId,
    userId,
    recipeName: recipeData?.name
  });

  const newRecipe = new Recipe({
    externalId: `temp_favorite_${Date.now()}`,
    name: recipeData.name || 'Untitled Recipe',
    description: recipeData.description || '',
    ingredients: Array.isArray(recipeData.ingredients) ? 
      recipeData.ingredients.map(ingredient => {
        if (typeof ingredient === 'string') {
          return {
            name: ingredient,
            amount: '1',
            unit: 'item',
            original: ingredient
          };
        }
        return {
          name: ingredient.name || ingredient.ingredient || '',
          amount: ingredient.amount || '1',
          unit: ingredient.unit || 'item',
          original: ingredient.original || ingredient.name || ingredient.ingredient || ''
        };
      }) : [],
    instructions: Array.isArray(recipeData.instructions) ?
      recipeData.instructions.map(step => {
        if (typeof step === 'object' && step.instruction) {
          return step.instruction;
        }
        return step.toString();
      }).join('\n') : 
      (recipeData.instructions || 'No instructions provided'),
    cookingTime: recipeData.cookingTime || 30,
    preparationTime: recipeData.prepTime || recipeData.preparationTime || 15,
    difficulty: recipeData.difficulty || 'medium',
    cuisine: recipeData.cuisine || 'International',
    servings: recipeData.servings || 4,
    userId: userId,
    isPublic: false,
    source: recipeData.source || 'ai_generation',
    isAIGenerated: true,
    searchQuery: recipeData.searchQuery || '',
    groceryList: recipeData.groceryList || []
  });
  
  const savedRecipe = await newRecipe.save();
  
  logger.info('Temporary recipe converted successfully', {
    tempId,
    newId: savedRecipe._id,
    userId,
    recipeName: savedRecipe.name
  });
  
  return savedRecipe;
};

// GET /api/users/profile - Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('favoriteRecipes', 'title images averageRating cookingTime')
      .populate('createdRecipes', 'title images averageRating cookingTime')
      .populate('following', 'username profileImage followerCount')
      .populate('followers', 'username profileImage followerCount');

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user profile',
      error: error.message
    });
  }
});

// PUT /api/users/profile - Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const {
      username,
      bio,
      profileImage,
      dietaryPreferences,
      allergens,
      skillLevel,
      preferences
    } = req.body;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if username is already taken (if changing)
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
      user.username = username;
    }

    // Update other fields
    if (bio !== undefined) user.bio = bio;
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (dietaryPreferences) user.dietaryPreferences = dietaryPreferences;
    if (allergens) user.allergens = allergens;
    if (skillLevel) user.skillLevel = skillLevel;
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.json({
      success: true,
      data: updatedUser,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

// GET /api/users/favorites - Get user's favorite recipes
router.get('/favorites', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get total count before pagination
    const totalFavorites = user.favoriteRecipes ? user.favoriteRecipes.length : 0;

    // Populate favorites with pagination
    await user.populate({
      path: 'favoriteRecipes',
      select: '-__v',
      options: {
        skip: skip,
        limit: limit,
        sort: { createdAt: -1 },
        strictPopulate: false
      }
    });

    res.json({
      success: true,
      data: {
        recipes: user.favoriteRecipes || [],
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalFavorites / limit),
          totalRecipes: totalFavorites
        }
      }
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching favorites',
      error: error.message
    });
  }
});

// POST /api/users/favorites/:recipeId - Add recipe to favorites
router.post('/favorites/:recipeId', auth, async (req, res) => {
  const startTime = Date.now();
  try {
    const recipeId = req.params.recipeId;
    
    // Validate recipeId is provided
    if (!recipeId || recipeId === 'undefined' || recipeId === 'null') {
      logger.warn('Invalid or missing recipe ID', {
        userId: req.user.id,
        recipeId,
        message: 'Frontend sent undefined/null recipe ID'
      });
      
      return res.status(400).json({
        success: false,
        message: 'Recipe ID is required and must be valid',
        error: 'INVALID_RECIPE_ID',
        details: 'The recipe ID was not provided or is invalid. Please ensure the recipe has a valid ID before adding to favorites.'
      });
    }
    
    logger.logUserActivity('ADD_FAVORITE_ATTEMPT', req, req.user.id, {
      recipeId,
      isTemporary: recipeId.startsWith('temp_'),
      hasRecipeData: !!req.body.recipeData
    });
    
    // Check if this is a temporary ID (non-MongoDB format ID)
    if (recipeId.startsWith('temp_')) {
      const { recipeData } = req.body;
      
      if (!recipeData) {
        logger.warn('Missing recipe data for temporary recipe', {
          userId: req.user.id,
          recipeId
        });
        
        return res.status(400).json({
          success: false,
          message: 'Recipe data must be provided when saving a temporary recipe',
          error: 'MISSING_RECIPE_DATA'
        });
      }
      
      // Convert temporary recipe to permanent
      const savedRecipe = await convertTemporaryRecipe(recipeId, recipeData, req.user.id);
      
      // Add to user's favorites
      const user = await User.findById(req.user.id);
      
      if (user.favoriteRecipes.includes(savedRecipe._id.toString())) {
        logger.warn('Recipe already in favorites after conversion', {
          userId: req.user.id,
          recipeId: savedRecipe._id
        });
        
        return res.status(400).json({
          success: false,
          message: 'Recipe already in favorites',
          error: 'RECIPE_ALREADY_IN_FAVORITES'
        });
      }
      
      user.favoriteRecipes.push(savedRecipe._id);
      await user.save();
      
      const processingTime = Date.now() - startTime;
      logger.logUserActivity('ADD_FAVORITE_SUCCESS_TEMP', req, req.user.id, {
        originalId: recipeId,
        newId: savedRecipe._id,
        recipeName: savedRecipe.name,
        processingTime: `${processingTime}ms`
      });
      
      return res.json({
        success: true,
        message: 'Recipe saved and added to favorites',
        recipeId: savedRecipe._id,
        recipeName: savedRecipe.name
      });
    }
    
    // Validate regular MongoDB ObjectId format
    if (!isValidObjectId(recipeId)) {
      logger.warn('Invalid recipe ID format', {
        userId: req.user.id,
        recipeId
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid recipe ID format',
        error: 'INVALID_RECIPE_ID'
      });
    }
    
    // Normal flow for regular MongoDB IDs
    logger.debug('Adding regular recipe to favorites', {
      userId: req.user.id,
      recipeId
    });
    
    const recipe = await Recipe.findById(recipeId);
    
    if (!recipe) {
      logger.warn('Recipe not found for favorites', {
        userId: req.user.id,
        recipeId
      });
      
      return res.status(404).json({
        success: false,
        message: 'Recipe not found',
        error: 'RECIPE_NOT_FOUND'
      });
    }

    const user = await User.findById(req.user.id);
    
    if (user.favoriteRecipes.includes(recipeId)) {
      logger.warn('Recipe already in favorites', {
        userId: req.user.id,
        recipeId,
        recipeName: recipe.name
      });
      
      return res.status(400).json({
        success: false,
        message: 'Recipe already in favorites',
        error: 'RECIPE_ALREADY_IN_FAVORITES'
      });
    }

    user.favoriteRecipes.push(recipeId);
    await user.save();

    const processingTime = Date.now() - startTime;
    logger.logUserActivity('ADD_FAVORITE_SUCCESS', req, req.user.id, {
      recipeId,
      recipeName: recipe.name,
      processingTime: `${processingTime}ms`
    });

    res.json({
      success: true,
      message: 'Recipe added to favorites',
      recipeName: recipe.name
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.logError(error, req, {
      action: 'ADD_FAVORITE',
      userId: req.user?.id,
      recipeId: req.params.recipeId,
      processingTime: `${processingTime}ms`
    });
    
    res.status(500).json({
      success: false,
      message: 'Error adding to favorites',
      error: error.message
    });
  }
});

// DELETE /api/users/favorites/:recipeId - Remove recipe from favorites
router.delete('/favorites/:recipeId', auth, async (req, res) => {
  const startTime = Date.now();
  try {
    const recipeId = req.params.recipeId;
    
    // Validate recipeId is provided
    if (!recipeId || recipeId === 'undefined' || recipeId === 'null') {
      logger.warn('Invalid or missing recipe ID for removal', {
        userId: req.user.id,
        recipeId,
        message: 'Frontend sent undefined/null recipe ID'
      });
      
      return res.status(400).json({
        success: false,
        message: 'Recipe ID is required and must be valid',
        error: 'INVALID_RECIPE_ID',
        details: 'The recipe ID was not provided or is invalid. Please ensure the recipe has a valid ID.'
      });
    }
    
    logger.logUserActivity('REMOVE_FAVORITE_ATTEMPT', req, req.user.id, {
      recipeId,
      isTemporary: recipeId.startsWith('temp_')
    });

    // Check if this is a temporary ID
    if (recipeId.startsWith('temp_')) {
      logger.warn('Attempt to remove temporary recipe from favorites', {
        userId: req.user.id,
        recipeId,
        message: 'Temporary recipes cannot be removed from favorites as they are not saved'
      });
      
      return res.status(400).json({
        success: false,
        message: 'Temporary recipes cannot be removed from favorites. Save the recipe first.',
        error: 'TEMPORARY_RECIPE_REMOVAL'
      });
    }

    // Validate MongoDB ObjectId format
    if (!isValidObjectId(recipeId)) {
      logger.warn('Invalid recipe ID format for favorites removal', {
        userId: req.user.id,
        recipeId,
        format: 'Invalid ObjectId format'
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid recipe ID format',
        error: 'INVALID_RECIPE_ID'
      });
    }
    
    const user = await User.findById(req.user.id);
    
    // Check if recipe is actually in favorites
    const favoriteIndex = user.favoriteRecipes.findIndex(fav => fav.toString() === recipeId);
    if (favoriteIndex === -1) {
      logger.warn('Recipe not found in user favorites', {
        userId: req.user.id,
        recipeId
      });
      
      return res.status(404).json({
        success: false,
        message: 'Recipe not found in favorites',
        error: 'RECIPE_NOT_IN_FAVORITES'
      });
    }
    
    // Get recipe name for logging (optional, don't fail if recipe doesn't exist)
    let recipeName = 'Unknown Recipe';
    try {
      const recipe = await Recipe.findById(recipeId);
      if (recipe) {
        recipeName = recipe.name;
      }
    } catch (recipeError) {
      logger.debug('Could not fetch recipe name for logging', {
        recipeId,
        error: recipeError.message
      });
    }
    
    user.favoriteRecipes.pull(recipeId);
    await user.save();

    const processingTime = Date.now() - startTime;
    logger.logUserActivity('REMOVE_FAVORITE_SUCCESS', req, req.user.id, {
      recipeId,
      recipeName,
      processingTime: `${processingTime}ms`
    });

    res.json({
      success: true,
      message: 'Recipe removed from favorites',
      recipeName
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.logError(error, req, {
      action: 'REMOVE_FAVORITE',
      userId: req.user?.id,
      recipeId: req.params.recipeId,
      processingTime: `${processingTime}ms`
    });
    
    res.status(500).json({
      success: false,
      message: 'Error removing from favorites',
      error: error.message
    });
  }
});

// GET /api/users/meal-plan - Get user's meal plan
router.get('/meal-plan', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const user = await User.findById(req.user.id)
      .populate({
        path: 'mealPlan.breakfast mealPlan.lunch mealPlan.dinner mealPlan.snacks',
        select: 'title images cookingTime prepTime difficulty averageRating'
      });

    let mealPlan = user.mealPlan;

    // Filter by date range if provided
    if (startDate || endDate) {
      mealPlan = user.mealPlan.filter(plan => {
        const planDate = new Date(plan.date);
        const start = startDate ? new Date(startDate) : new Date('1900-01-01');
        const end = endDate ? new Date(endDate) : new Date('2100-01-01');
        return planDate >= start && planDate <= end;
      });
    }

    res.json({
      success: true,
      data: mealPlan.sort((a, b) => new Date(a.date) - new Date(b.date))
    });
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching meal plan',
      error: error.message
    });
  }
});

// POST /api/users/meal-plan - Add/Update meal plan entry
router.post('/meal-plan', auth, async (req, res) => {
  try {
    const { date, breakfast, lunch, dinner, snacks } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    const user = await User.findById(req.user.id);
    
    // Check if meal plan for this date already exists
    const existingPlanIndex = user.mealPlan.findIndex(
      plan => plan.date.toDateString() === new Date(date).toDateString()
    );

    const mealPlanEntry = {
      date: new Date(date),
      breakfast: breakfast || null,
      lunch: lunch || null,
      dinner: dinner || null,
      snacks: snacks || []
    };

    if (existingPlanIndex !== -1) {
      // Update existing plan
      user.mealPlan[existingPlanIndex] = mealPlanEntry;
    } else {
      // Add new plan
      user.mealPlan.push(mealPlanEntry);
    }

    await user.save();

    res.json({
      success: true,
      message: 'Meal plan updated successfully',
      data: mealPlanEntry
    });
  } catch (error) {
    console.error('Error updating meal plan:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating meal plan',
      error: error.message
    });
  }
});

// GET /api/users/shopping-list - Get user's shopping list
router.get('/shopping-list', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.json({
      success: true,
      data: user.shoppingList.sort((a, b) => a.category.localeCompare(b.category))
    });
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shopping list',
      error: error.message
    });
  }
});

// POST /api/users/shopping-list - Add item to shopping list
router.post('/shopping-list', auth, async (req, res) => {
  try {
    const { name, amount = 1, unit = 'item', category = 'other' } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Item name is required'
      });
    }

    const user = await User.findById(req.user.id);
    
    // Check if item already exists
    const existingItem = user.shoppingList.find(item => 
      item.name.toLowerCase() === name.toLowerCase()
    );

    if (existingItem) {
      existingItem.amount += amount;
    } else {
      user.shoppingList.push({ name, amount, unit, category });
    }

    await user.save();

    res.json({
      success: true,
      message: 'Item added to shopping list',
      data: user.shoppingList
    });
  } catch (error) {
    console.error('Error adding to shopping list:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding to shopping list',
      error: error.message
    });
  }
});

// PUT /api/users/shopping-list/:itemId - Update shopping list item
router.put('/shopping-list/:itemId', auth, async (req, res) => {
  try {
    const { completed, amount, unit } = req.body;

    const user = await User.findById(req.user.id);
    const item = user.shoppingList.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Shopping list item not found'
      });
    }

    if (completed !== undefined) item.completed = completed;
    if (amount !== undefined) item.amount = amount;
    if (unit !== undefined) item.unit = unit;

    await user.save();

    res.json({
      success: true,
      message: 'Shopping list item updated',
      data: item
    });
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating shopping list item',
      error: error.message
    });
  }
});

// DELETE /api/users/shopping-list/:itemId - Remove item from shopping list
router.delete('/shopping-list/:itemId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.shoppingList.pull(req.params.itemId);
    await user.save();

    res.json({
      success: true,
      message: 'Item removed from shopping list'
    });
  } catch (error) {
    console.error('Error removing shopping list item:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing shopping list item',
      error: error.message
    });
  }
});

// GET /api/users/pantry - Get user's pantry
router.get('/pantry', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Sort by expiration date (nearest first) and category
    const pantry = user.pantry.sort((a, b) => {
      if (a.expirationDate && b.expirationDate) {
        return new Date(a.expirationDate) - new Date(b.expirationDate);
      }
      if (a.expirationDate && !b.expirationDate) return -1;
      if (!a.expirationDate && b.expirationDate) return 1;
      return a.category.localeCompare(b.category);
    });

    res.json({
      success: true,
      data: pantry
    });
  } catch (error) {
    console.error('Error fetching pantry:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pantry',
      error: error.message
    });
  }
});

// POST /api/users/pantry - Add item to pantry
router.post('/pantry', auth, async (req, res) => {
  try {
    const { name, amount = 1, unit = 'item', expirationDate, category = 'pantry' } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Item name is required'
      });
    }

    const user = await User.findById(req.user.id);
    
    user.pantry.push({
      name,
      amount,
      unit,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      category
    });

    await user.save();

    res.json({
      success: true,
      message: 'Item added to pantry',
      data: user.pantry[user.pantry.length - 1]
    });
  } catch (error) {
    console.error('Error adding to pantry:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding to pantry',
      error: error.message
    });
  }
});

// PUT /api/users/pantry/:itemId - Update pantry item
router.put('/pantry/:itemId', auth, async (req, res) => {
  try {
    const { name, amount, unit, expirationDate, category } = req.body;

    const user = await User.findById(req.user.id);
    const item = user.pantry.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Pantry item not found'
      });
    }

    if (name !== undefined) item.name = name;
    if (amount !== undefined) item.amount = amount;
    if (unit !== undefined) item.unit = unit;
    if (expirationDate !== undefined) {
      item.expirationDate = expirationDate ? new Date(expirationDate) : null;
    }
    if (category !== undefined) item.category = category;

    await user.save();

    res.json({
      success: true,
      message: 'Pantry item updated',
      data: item
    });
  } catch (error) {
    console.error('Error updating pantry item:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating pantry item',
      error: error.message
    });
  }
});

// DELETE /api/users/pantry/:itemId - Remove item from pantry
router.delete('/pantry/:itemId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.pantry.pull(req.params.itemId);
    await user.save();

    res.json({
      success: true,
      message: 'Item removed from pantry'
    });
  } catch (error) {
    console.error('Error removing pantry item:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing pantry item',
      error: error.message
    });
  }
});

// POST /api/users/follow/:userId - Follow a user
router.post('/follow/:userId', auth, async (req, res) => {
  try {
    if (req.params.userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot follow yourself'
      });
    }

    const userToFollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.id);

    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already following
    if (currentUser.following.includes(req.params.userId)) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    // Add to following/followers lists
    currentUser.following.push(req.params.userId);
    userToFollow.followers.push(req.user.id);

    await Promise.all([currentUser.save(), userToFollow.save()]);

    res.json({
      success: true,
      message: 'Successfully followed user'
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({
      success: false,
      message: 'Error following user',
      error: error.message
    });
  }
});

// DELETE /api/users/follow/:userId - Unfollow a user
router.delete('/follow/:userId', auth, async (req, res) => {
  try {
    const userToUnfollow = await User.findById(req.params.userId);
    const currentUser = await User.findById(req.user.id);

    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove from following/followers lists
    currentUser.following.pull(req.params.userId);
    userToUnfollow.followers.pull(req.user.id);

    await Promise.all([currentUser.save(), userToUnfollow.save()]);

    res.json({
      success: true,
      message: 'Successfully unfollowed user'
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({
      success: false,
      message: 'Error unfollowing user',
      error: error.message
    });
  }
});

// GET /api/users/search - Search for users
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const skip = (page - 1) * limit;
    
    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } }
      ],
      isActive: true
    })
      .select('username profileImage bio followerCount recipeCount')
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching users',
      error: error.message
    });
  }
});

module.exports = router;
