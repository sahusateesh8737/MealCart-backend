const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const Recipe = require('../models/Recipe');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

let aiClient = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({ key: process.env.GEMINI_API_KEY });
  } catch (err) {
    console.error('Failed to init Gemini in grocerylist:', err);
  }
}


// Generate grocery list from selected recipe IDs
router.post('/generate', auth, async (req, res) => {
  try {
    const { recipeIds, servingsMultiplier = {} } = req.body;

    if (!recipeIds || !Array.isArray(recipeIds) || recipeIds.length === 0) {
      return res.status(400).json({
        message: 'Recipe IDs array is required and cannot be empty',
        error: 'MISSING_RECIPE_IDS',
      });
    }

    // Fetch recipes owned by the user
    const recipes = await Recipe.find({
      _id: { $in: recipeIds },
      userId: req.user._id,
    });

    if (recipes.length === 0) {
      return res.status(404).json({
        message: 'No recipes found for the provided IDs',
        error: 'RECIPES_NOT_FOUND',
      });
    }

    if (recipes.length !== recipeIds.length) {
      const foundIds = recipes.map((r) => r._id.toString());
      const missingIds = recipeIds.filter((id) => !foundIds.includes(id));
      console.warn('Some recipes not found:', missingIds);
    }

    // Aggregate ingredients from all recipes
    let groceryList = [];
    
    if (aiClient) {
      // Create raw text list of all ingredients
      const rawIngredientsText = recipes.map((recipe) => {
        const multiplier = servingsMultiplier[recipe._id.toString()] || 1;
        const ingredientsText = recipe.ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join("\n");
        return `Recipe: ${recipe.name} (Multiplier: ${multiplier})\n${ingredientsText}`;
      }).join("\n\n");

      const prompt = `You are an expert culinary assistant managing a grocery list.
      Here are the ingredients from selected recipes:
      ${rawIngredientsText}

      Combine identical or strongly similar ingredients together intelligently. Mathematically add their amounts if the units are compatible (e.g. merging cups, tbps, or pieces). 
      Return ONLY a strict, minified JSON array of objects representing the final consolidated grocery list. Do NOT include markdown blocks (\`\`\`json). The objects MUST have these exact keys:
      [
        {
          "name": "string (clean name of ingredient)",
          "amount": "string or number (total amount)",
          "unit": "string (e.g. cups, tbsp, grams, pieces - leave empty if not applicable)",
          "category": "string (MUST be one of: Produce, Dairy, Pantry, Proteins, Other)"
        }
      ]
      No additional text, ONLY the JSON array.`;

      try {
        const aiResponse = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        
        let responseText = typeof aiResponse.text === 'function' ? aiResponse.text() : aiResponse.text;
        responseText = responseText || '';
        
        // Extrace JSON using regex block if there is surrounding markdown
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          responseText = jsonMatch[0];
        } else {
           responseText = responseText.replace(/^\`\`\`json\n?/, '').replace(/\n?\`\`\`$/, '');
        }
        
        groceryList = JSON.parse(responseText.trim());
        
        // Ensure strictly categorized
        groceryList = groceryList.map(item => {
          const allowedCategories = ['Produce', 'Dairy', 'Pantry', 'Proteins', 'Other'];
          return {
             ...item,
             category: allowedCategories.includes(item.category) ? item.category : 'Other',
             amount: item.amount.toString()
          };
        });
      } catch (aiError) {
        require('fs').writeFileSync('debug_grocery_ai.txt', 'Error: ' + aiError.message + '\nStack: ' + aiError.stack);
        console.error('AI Grocery List Generation Failed:', aiError);
        return res.status(500).json({ message: 'Failed to intelligently generate grocery list using AI.', error: aiError.message });
      }
    } else {
      return res.status(503).json({ message: 'Gemini API is not configured.' });
    }

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

    // PERSIST TO USER: Append unique items to user's grocery list
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.groceryList) user.groceryList = [];

    const newItems = groceryList.map(item => ({
      _id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: item.name || 'Unknown item',
      amount: item.amount ? item.amount.toString() : '1',
      unit: item.unit || '',
      category: item.category || 'Other',
      checked: false,
      addedAt: new Date()
    }));

    user.groceryList.push(...newItems);
    await user.save();

    res.json({
      message: 'Grocery list generated and saved successfully',
      groceryList: user.groceryList, // Return full updated list
      generatedItems: newItems,
      categorizedList,
      shoppingTips,
      summary: {
        totalItems: groceryList.length,
        recipesUsed: recipes.length,
        categories: Object.keys(categorizedList),
        estimatedShoppingTime: Math.ceil(groceryList.length / 10) * 5,
      }
    });
  } catch (error) {
    require('fs').writeFileSync('debug_grocery_outer.txt', 'Error: ' + error.message + '\nStack: ' + error.stack);
    console.error('Generate grocery list error:', error);
    res.status(500).json({
      message: 'Server error while generating grocery list',
      error: 'INTERNAL_SERVER_ERROR',
      details: error.message
    });
  }
});

// Helper function to categorize ingredients
function categorizeIngredient(ingredientName) {
  const name = ingredientName.toLowerCase();

  const categories = {
    vegetables: [
      'tomato', 'onion', 'garlic', 'carrot', 'celery', 'pepper', 'lettuce', 'spinach', 
      'potato', 'cucumber', 'mushroom', 'broccoli', 'cauliflower', 'zucchini', 'herbs',
      'cilantro', 'parsley', 'basil', 'thyme', 'rosemary'
    ],
    fruits: [
      'apple', 'banana', 'lemon', 'lime', 'orange', 'strawberry', 'berry', 'mango'
    ],
    meat: [
      'chicken', 'beef', 'pork', 'turkey', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 
      'lobster', 'bacon', 'ham', 'sausage', 'ground', 'steak', 'lamb'
    ],
    dairy: [
      'milk', 'cheese', 'butter', 'yogurt', 'cream', 'egg', 'sour cream', 
      'cottage cheese', 'mozzarella', 'cheddar', 'parmesan'
    ],
    grains: [
      'flour', 'rice', 'pasta', 'bread', 'oats', 'quinoa', 'couscous'
    ],
    spices: [
      'salt', 'pepper', 'cumin', 'paprika', 'oregano', 'cinnamon', 'ginger', 'turmeric'
    ],
    frozen: ['frozen', 'ice cream', 'peas', 'corn'],
    beverages: ['water', 'juice', 'soda', 'beer', 'wine', 'coffee', 'tea'],
    canned: ['canned', 'can', 'tomato sauce', 'tomato paste', 'broth', 'stock']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((keyword) => name.includes(keyword))) {
      return category;
    }
  }

  return 'other';
}

// Helper function to generate shopping tips
function generateShoppingTips(groceryList) {
  const tips = [];

  // Check for perishables
  const produceItems = groceryList.filter((item) => item.category === 'Produce').length;
  if (produceItems > 5) {
    tips.push('You have many fresh produce items. Shop for these last to keep them fresh.');
  }

  // Check for meat/seafood
  const proteinItems = groceryList.filter((item) => item.category === 'Meat & Seafood').length;
  if (proteinItems > 0) {
    tips.push("Don't forget to bring a cooler bag for meat and seafood items.");
  }

  // Check for dairy
  const dairyItems = groceryList.filter((item) => item.category === 'Dairy & Eggs').length;
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
      history: [],
    });
  } catch (error) {
    console.error('Get grocery list history error:', error);
    res.status(500).json({
      message: 'Server error while fetching grocery list history',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Get user's current grocery list
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('groceryList');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    const list = user.groceryList || [];

    res.json({
      success: true,
      groceryList: list,
      itemCount: list.length,
    });
  } catch (error) {
    console.error('Get grocery list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching grocery list',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Add item to grocery list
router.post('/item', auth, async (req, res) => {
  try {
    const { name, amount, unit, category, checked = false } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Item name is required',
        error: 'MISSING_ITEM_NAME',
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    // Initialize groceryList if it doesn't exist
    if (!user.groceryList) {
      user.groceryList = [];
    }

    // Create new item
    const newItem = {
      _id: new Date().getTime().toString(), // Simple ID generation
      name: name.trim(),
      amount: amount || '1',
      unit: unit || '',
      category: category || categorizeIngredient(name),
      checked: checked,
      addedAt: new Date(),
    };

    user.groceryList.push(newItem);
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Item added to grocery list',
      item: newItem,
      groceryList: user.groceryList,
      itemCount: user.groceryList.length,
    });
  } catch (error) {
    console.error('Add grocery list item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding item to grocery list',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Update grocery list item
router.put('/item/:itemId', auth, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, amount, unit, category, checked } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    if (!user.groceryList) {
      return res.status(404).json({
        success: false,
        message: 'Grocery list is empty',
        error: 'EMPTY_GROCERY_LIST',
      });
    }

    const itemIndex = user.groceryList.findIndex((item) => item._id === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in grocery list',
        error: 'ITEM_NOT_FOUND',
      });
    }

    // Update item fields
    if (name !== undefined) user.groceryList[itemIndex].name = name.trim();
    if (amount !== undefined) user.groceryList[itemIndex].amount = amount;
    if (unit !== undefined) user.groceryList[itemIndex].unit = unit;
    if (category !== undefined) user.groceryList[itemIndex].category = category;
    if (checked !== undefined) user.groceryList[itemIndex].checked = checked;

    await user.save();

    res.json({
      success: true,
      message: 'Item updated successfully',
      item: user.groceryList[itemIndex],
      groceryList: user.groceryList,
    });
  } catch (error) {
    console.error('Update grocery list item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating item',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Delete grocery list item
router.delete('/item/:itemId', auth, async (req, res) => {
  try {
    const { itemId } = req.params;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    if (!user.groceryList) {
      return res.status(404).json({
        success: false,
        message: 'Grocery list is empty',
        error: 'EMPTY_GROCERY_LIST',
      });
    }

    const itemIndex = user.groceryList.findIndex((item) => item._id === itemId);

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in grocery list',
        error: 'ITEM_NOT_FOUND',
      });
    }

    user.groceryList.splice(itemIndex, 1);
    await user.save();

    res.json({
      success: true,
      message: 'Item deleted successfully',
      groceryList: user.groceryList,
    });
  } catch (error) {
    console.error('Delete grocery list item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting item',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Clear all checked items
router.delete('/checked', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    if (!user.groceryList) {
      return res.json({
        success: true,
        message: 'Grocery list is already empty',
        groceryList: [],
      });
    }

    const initialCount = user.groceryList.length;
    user.groceryList = user.groceryList.filter((item) => !item.checked);
    await user.save();

    const deletedCount = initialCount - user.groceryList.length;

    res.json({
      success: true,
      message: `${deletedCount} checked item(s) removed`,
      groceryList: user.groceryList,
      deletedCount,
    });
  } catch (error) {
    console.error('Clear checked items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while clearing checked items',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Clear entire grocery list
router.delete('/clear', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    const itemCount = user.groceryList ? user.groceryList.length : 0;
    user.groceryList = [];
    await user.save();

    res.json({
      success: true,
      message: 'Grocery list cleared',
      deletedCount: itemCount,
      groceryList: [],
    });
  } catch (error) {
    console.error('Clear grocery list error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while clearing grocery list',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

// Get grocery list history for a user
router.get('/history', auth, async (req, res) => {
  try {
    // This is a placeholder for grocery list history functionality
    // In a full implementation, you might want to store grocery lists in a separate collection
    res.json({
      message: 'Grocery list history feature coming soon',
      history: [],
    });
  } catch (error) {
    console.error('Get grocery list history error:', error);
    res.status(500).json({
      message: 'Server error while fetching grocery list history',
      error: 'INTERNAL_SERVER_ERROR',
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
        error: 'MISSING_GROCERY_LIST',
      });
    }

    // This is a placeholder for saving grocery lists
    // In a full implementation, you might want a GroceryList model
    res.json({
      message: 'Grocery list saving feature coming soon',
      listName: name || 'Untitled List',
      itemCount: groceryList.length,
    });
  } catch (error) {
    console.error('Save grocery list error:', error);
    res.status(500).json({
      message: 'Server error while saving grocery list',
      error: 'INTERNAL_SERVER_ERROR',
    });
  }
});

module.exports = router;
