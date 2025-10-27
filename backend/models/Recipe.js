const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  externalId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Recipe name is required'],
    trim: true,
    maxlength: [200, 'Recipe name cannot exceed 200 characters']
  },
  image: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  ingredients: [{
    name: {
      type: String,
      required: true
    },
    amount: {
      type: String
    },
    unit: {
      type: String
    },
    original: {
      type: String,
      required: true
    }
  }],
  instructions: {
    type: String,
    required: [true, 'Instructions are required']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  // Additional recipe metadata
  cookingTime: {
    type: Number, // in minutes
    min: 0
  },
  preparationTime: {
    type: Number, // in minutes
    min: 0
  },
  servings: {
    type: Number,
    min: 1,
    default: 1
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  dietaryTags: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'low-carb', 'keto', 'paleo']
  }],
  nutrition: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    fiber: Number
  },
  // User interactions
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  timesCooked: {
    type: Number,
    default: 0,
    min: 0
  },
  lastCooked: {
    type: Date
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  // Recipe source and metadata
  source: {
    type: String,
    enum: ['ai_search', 'ai_generation', 'external_api', 'user_created'],
    default: 'user_created'
  },
  groceryList: [{
    type: String
  }],
  searchQuery: {
    type: String // Original search query for AI-generated recipes
  },
  isAIGenerated: {
    type: Boolean,
    default: false
  }
});

// Compound index for user-specific queries
recipeSchema.index({ userId: 1, createdAt: -1 });
recipeSchema.index({ userId: 1, name: 'text' });

// Instance method to increment times cooked
recipeSchema.methods.markAsCooked = function() {
  this.timesCooked += 1;
  this.lastCooked = new Date();
  return this.save();
};

// Static method to find recipes by ingredients
recipeSchema.statics.findByIngredients = function(userId, ingredients) {
  const ingredientRegex = ingredients.map(ing => new RegExp(ing, 'i'));
  return this.find({
    userId,
    'ingredients.name': { $in: ingredientRegex }
  });
};

module.exports = mongoose.model('Recipe', recipeSchema);
