const mongoose = require('mongoose');
const Recipe = require('./models/Recipe');
const User = require('./models/User'); // Need a user to assign recipes to
require('dotenv').config();

const sampleRecipes = [
  {
    externalId: 'seed_1',
    name: 'Spaghetti Carbonara',
    description: 'A classic Italian pasta dish with eggs, cheese, guanciale, and black pepper.',
    ingredients: [
      { name: 'Spaghetti', amount: '400', unit: 'g', original: '400g Spaghetti' },
      { name: 'Eggs', amount: '4', unit: 'large', original: '4 large Eggs' },
      { name: 'Pecorino Romano', amount: '1', unit: 'cup', original: '1 cup Pecorino' },
      { name: 'Guanciale', amount: '150', unit: 'g', original: '150g Guanciale' },
    ],
    instructions: '1. Boil pasta. 2. Fry guanciale. 3. Mix eggs and cheese. 4. Combine all.',
    cookingTime: 20,
    preparationTime: 10,
    difficulty: 'medium',
    servings: 4,
    cuisine: 'Italian',
    isPublic: true,
    mealType: ['dinner'],
  },
  {
    externalId: 'seed_2',
    name: 'Chicken Curry',
    description: 'A rich and spicy Indian chicken curry.',
    ingredients: [
      { name: 'Chicken', amount: '500', unit: 'g', original: '500g Chicken' },
      { name: 'Onions', amount: '2', unit: 'medium', original: '2 Onions' },
      { name: 'Tomatoes', amount: '2', unit: 'medium', original: '2 Tomatoes' },
      { name: 'Spices', amount: '2', unit: 'tbsp', original: '2 tbsp Spices' },
    ],
    instructions:
      '1. Sauté onions. 2. Add chicken and seal. 3. Add spices and tomatoes. 4. Simmer until cooked.',
    cookingTime: 45,
    preparationTime: 15,
    difficulty: 'medium',
    servings: 4,
    cuisine: 'Indian',
    isPublic: true,
    mealType: ['dinner'],
  },
  {
    externalId: 'seed_3',
    name: 'Vegetable Stir Fry',
    description: 'Quick and healthy vegetable stir fry.',
    ingredients: [
      { name: 'Broccoli', amount: '1', unit: 'head', original: '1 head Broccoli' },
      { name: 'Carrots', amount: '2', unit: 'medium', original: '2 Carrots' },
      { name: 'Soy Sauce', amount: '2', unit: 'tbsp', original: '2 tbsp Soy Sauce' },
    ],
    instructions: '1. Chop vegetables. 2. Stir fry in hot pan. 3. Add sauce.',
    cookingTime: 15,
    preparationTime: 10,
    difficulty: 'easy',
    servings: 2,
    cuisine: 'Asian',
    isPublic: true,
    mealType: ['lunch', 'dinner'],
  },
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mealcart');
    console.log('Connected to MongoDB');

    // Find or create a default user to own these recipes
    let user = await User.findOne({ email: 'test@example.com' });
    if (!user) {
      user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });
      console.log('Created test user');
    }

    // Insert recipes
    for (const recipe of sampleRecipes) {
      recipe.userId = user._id;
      // Check if exists to avoid duplicates
      const exists = await Recipe.findOne({ externalId: recipe.externalId });
      if (!exists) {
        await Recipe.create(recipe);
        console.log(`Added: ${recipe.name}`);
      } else {
        console.log(`Skipped: ${recipe.name} (Already exists)`);
      }
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
