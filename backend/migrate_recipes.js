const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Recipe = require('./models/Recipe.js');

// Load environment variables
dotenv.config();

async function updateRecipes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Update all existing recipes to be public
    const result = await Recipe.updateMany(
      { isPublic: { $exists: false } },
      { $set: { isPublic: true } }
    );
    
    console.log(`Updated ${result.modifiedCount} recipes to be public`);
    
    // Verify the update
    const recipes = await Recipe.find({});
    console.log('\nRecipe public status after update:');
    recipes.forEach((r, i) => {
      console.log(`${i+1}. ${r.name} - Public: ${r.isPublic}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateRecipes();
