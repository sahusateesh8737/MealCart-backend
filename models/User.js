const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  profileImage: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  dietaryPreferences: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'soy-free', 'keto', 'paleo', 'low-carb', 'high-protein', 'pescatarian', 'halal', 'kosher']
  }],
  allergens: [{
    type: String,
    enum: ['nuts', 'dairy', 'eggs', 'soy', 'wheat', 'fish', 'shellfish', 'sesame']
  }],
  skillLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
    default: 'beginner'
  },
  favoriteRecipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }],
  createdRecipes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Recipe'
  }],
  mealPlan: [{
    date: { type: Date, required: true },
    breakfast: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
    lunch: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
    dinner: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
    snacks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' }]
  }],
  shoppingList: [{
    name: { type: String, required: true },
    amount: { type: Number, default: 1 },
    unit: { type: String, default: 'item' },
    completed: { type: Boolean, default: false },
    category: { type: String, enum: ['produce', 'dairy', 'meat', 'pantry', 'frozen', 'other'], default: 'other' }
  }],
  groceryList: [{
    _id: { type: String },
    name: { type: String, required: true },
    amount: { type: String, default: '1' },
    unit: { type: String, default: '' },
    category: { type: String, default: 'Other' },
    checked: { type: Boolean, default: false },
    addedAt: { type: Date, default: Date.now }
  }],
  pantry: [{
    name: { type: String, required: true },
    amount: { type: Number, default: 1 },
    unit: { type: String, default: 'item' },
    expirationDate: { type: Date },
    category: { type: String, enum: ['produce', 'dairy', 'meat', 'pantry', 'frozen'], default: 'pantry' }
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  preferences: {
    cookingTime: {
      type: String,
      enum: ['quick', 'medium', 'long', 'any'],
      default: 'any'
    },
    preferredCuisines: [{
      type: String,
      enum: ['italian', 'mexican', 'asian', 'american', 'indian', 'mediterranean', 'french', 'thai', 'chinese', 'japanese', 'other']
    }],
    favoriteIngredients: [String],
    dislikedIngredients: [String],
    notifications: {
      email: { type: Boolean, default: true },
      newRecipes: { type: Boolean, default: true },
      mealReminders: { type: Boolean, default: false }
    }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for follower count
userSchema.virtual('followerCount').get(function() {
  return this.followers ? this.followers.length : 0;
});

// Virtual for following count
userSchema.virtual('followingCount').get(function() {
  return this.following ? this.following.length : 0;
});

// Virtual for recipe count
userSchema.virtual('recipeCount').get(function() {
  return this.createdRecipes ? this.createdRecipes.length : 0;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get public profile
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);
