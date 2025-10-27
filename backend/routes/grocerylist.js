const express = require('express');
const Recipe = require('../models/Recipe');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Generate grocery list from selected recipe IDs
router.post('/generate', auth, async (req, res) => {
  try {
    const { recipeIds, servingsMultiplier = {} } = req.body;

    if (!recipeIds || !Array.isArray(recipeIds) || recipeIds.length === 0) {
      return res.status(400).json({ 
        message: 'Recipe IDs array is required and cannot be empty',
        error: 'MISSING_RECIPE_IDS'
      });
    }

    // Fetch recipes owned by the user
    const recipes = await Recipe.find({
      _id: { $in: recipeIds },
      userId: req.user._id
    });

    if (recipes.length === 0) {
      return res.status(404).json({ 
        message: 'No recipes found for the provided IDs',
        error: 'RECIPES_NOT_FOUND'
      });
    }

    if (recipes.length !== recipeIds.length) {
      const foundIds = recipes.map(r => r._id.toString());
      const missingIds = recipeIds.filter(id => !foundIds.includes(id));
      console.warn('Some recipes not found:', missingIds);
    }

    // Aggregate ingredients from all recipes
    const ingredientMap = new Map();

    recipes.forEach(recipe => {
      const multiplier = servingsMultiplier[recipe._id.toString()] || 1;
      
      recipe.ingredients.forEach(ingredient => {
        const key = ingredient.name.toLowerCase().trim();
        
        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key);
          
          // Try to combine quantities if units match
          if (existing.unit === ingredient.unit && 
              !isNaN(parseFloat(existing.amount)) && 
              !isNaN(parseFloat(ingredient.amount))) {
            const combinedAmount = parseFloat(existing.amount) + (parseFloat(ingredient.amount) * multiplier);
            existing.amount = combinedAmount.toString();
            existing.recipes.push({
              recipeId: recipe._id,
              recipeName: recipe.name,
              originalAmount: ingredient.amount,
              multiplier
            });
          } else {
            // Different units or non-numeric amounts, keep separate
            existing.alternativeAmounts.push({
              amount: (parseFloat(ingredient.amount) * multiplier).toString() || ingredient.amount,
              unit: ingredient.unit,
              original: ingredient.original,
              recipeId: recipe._id,
              recipeName: recipe.name,
              multiplier
            });
          }
        } else {
          ingredientMap.set(key, {
            name: ingredient.name,
            amount: (parseFloat(ingredient.amount) * multiplier).toString() || ingredient.amount,
            unit: ingredient.unit,
            original: ingredient.original,
            recipes: [{
              recipeId: recipe._id,
              recipeName: recipe.name,
              originalAmount: ingredient.amount,
              multiplier
            }],
            alternativeAmounts: [],
            category: categorizeIngredient(ingredient.name)
          });
        }
      });
    });

    // Convert map to array and sort by category
    const groceryList = Array.from(ingredientMap.values()).sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.name.localeCompare(b.name);
    });

    // Group by category for better organization
    const categorizedList = groceryList.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});

    // Generate shopping tips
    const shoppingTips = generateShoppingTips(groceryList);

    res.json({
      message: 'Grocery list generated successfully',
      groceryList,
      categorizedList,
      shoppingTips,
      summary: {
        totalItems: groceryList.length,
        recipesUsed: recipes.length,
        categories: Object.keys(categorizedList),
        estimatedShoppingTime: Math.ceil(groceryList.length / 10) * 5 // 5 min per 10 items
      },
      recipes: recipes.map(recipe => ({
        id: recipe._id,
        name: recipe.name,
        servings: recipe.servings,
        multiplier: servingsMultiplier[recipe._id.toString()] || 1
      }))
    });
  } catch (error) {
    console.error('Generate grocery list error:', error);
    res.status(500).json({ 
      message: 'Server error while generating grocery list',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Helper function to categorize ingredients
function categorizeIngredient(ingredientName) {
  const name = ingredientName.toLowerCase();
  
  const categories = {
    'Produce': ['tomato', 'onion', 'garlic', 'carrot', 'celery', 'pepper', 'lettuce', 'spinach', 'potato', 'apple', 'banana', 'lemon', 'lime', 'orange', 'cucumber', 'mushroom', 'broccoli', 'cauliflower', 'zucchini', 'herbs', 'cilantro', 'parsley', 'basil', 'thyme', 'rosemary'],
    'Meat & Seafood': ['chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'bacon', 'ham', 'sausage', 'ground'],
    'Dairy & Eggs': ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'egg', 'sour cream', 'cottage cheese', 'mozzarella', 'cheddar', 'parmesan'],
    'Pantry & Dry Goods': ['flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'rice', 'pasta', 'bread', 'oats', 'quinoa', 'beans', 'lentils', 'nuts', 'seeds'],
    'Spices & Seasonings': ['cumin', 'paprika', 'oregano', 'bay leaves', 'cinnamon', 'nutmeg', 'ginger', 'turmeric', 'curry', 'chili', 'cayenne'],
    'Condiments & Sauces': ['ketchup', 'mustard', 'mayo', 'soy sauce', 'hot sauce', 'bbq sauce', 'worcestershire', 'honey', 'maple syrup'],
    'Frozen': ['frozen', 'ice cream'],
    'Beverages': ['water', 'juice', 'soda', 'beer', 'wine', 'coffee', 'tea'],
    'Baking': ['baking powder', 'baking soda', 'vanilla', 'extract', 'cocoa', 'chocolate'],
    'Canned Goods': ['canned', 'can', 'tomato sauce', 'tomato paste', 'broth', 'stock']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => name.includes(keyword))) {
      return category;
    }
  }

  return 'Other';
}

// Helper function to generate shopping tips
function generateShoppingTips(groceryList) {
  const tips = [];
  
  // Check for perishables
  const produceItems = groceryList.filter(item => item.category === 'Produce').length;
  if (produceItems > 5) {
    tips.push('You have many fresh produce items. Shop for these last to keep them fresh.');
  }

  // Check for meat/seafood
  const proteinItems = groceryList.filter(item => item.category === 'Meat & Seafood').length;
  if (proteinItems > 0) {
    tips.push('Don\'t forget to bring a cooler bag for meat and seafood items.');
  }

  // Check for dairy
  const dairyItems = groceryList.filter(item => item.category === 'Dairy & Eggs').length;
  if (dairyItems > 3) {
    tips.push('Check expiration dates on dairy products before purchasing.');
  }

  // General tips
  tips.push('Organize your list by store layout to save time.');
  tips.push('Check your pantry before shopping to avoid duplicate purchases.');

  return tips;
}

// Get grocery list history for a user
router.get('/history', auth, async (req, res) => {
  try {
    // This is a placeholder for grocery list history functionality
    // In a full implementation, you might want to store grocery lists in a separate collection
    res.json({
      message: 'Grocery list history feature coming soon',
      history: []
    });
  } catch (error) {
    console.error('Get grocery list history error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching grocery list history',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Save grocery list (for future implementation)
router.post('/save', auth, async (req, res) => {
  try {
    const { groceryList, name } = req.body;

    if (!groceryList || !Array.isArray(groceryList)) {
      return res.status(400).json({ 
        message: 'Grocery list array is required',
        error: 'MISSING_GROCERY_LIST'
      });
    }

    // This is a placeholder for saving grocery lists
    // In a full implementation, you might want a GroceryList model
    res.json({
      message: 'Grocery list saving feature coming soon',
      listName: name || 'Untitled List',
      itemCount: groceryList.length
    });
  } catch (error) {
    console.error('Save grocery list error:', error);
    res.status(500).json({ 
      message: 'Server error while saving grocery list',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
