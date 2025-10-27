const axios = require('axios');

class ImageService {
  constructor() {
    // Google Custom Search API for more accurate recipe images
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    this.googleSearchUrl = 'https://www.googleapis.com/customsearch/v1';
    
    // Using Unsplash API for high-quality food images as backup
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
    this.unsplashBaseUrl = 'https://api.unsplash.com';
    
    // Fallback to free food image APIs
    this.fallbackApis = [
      {
        name: 'Foodish',
        url: 'https://foodish-api.herokuapp.com/api/',
        method: 'GET'
      }
    ];
  }

  /**
   * Search for food images based on recipe name
   * @param {string} recipeName - Name of the recipe
   * @param {string} cuisine - Cuisine type (optional)
   * @returns {Promise<string>} - Image URL
   */
  async searchRecipeImage(recipeName, cuisine = '') {
    try {
      console.log(`Searching for image for recipe: "${recipeName}", cuisine: "${cuisine}"`);
      
      // Try Google Custom Search first (most accurate)
      if (this.googleApiKey && this.googleSearchEngineId) {
        const googleResult = await this.searchGoogleImages(recipeName, cuisine);
        if (googleResult) {
          console.log(`Found Google image for "${recipeName}": ${googleResult}`);
          return googleResult;
        }
      }

      // Try Unsplash as backup
      if (this.unsplashAccessKey) {
        // First try curated food collections for better accuracy
        const curatedResult = await this.searchUnsplashCollections(recipeName, cuisine);
        if (curatedResult) {
          console.log(`Found Unsplash curated image for "${recipeName}": ${curatedResult}`);
          return curatedResult;
        }
        
        // Then try regular search
        const unsplashResult = await this.searchUnsplash(recipeName, cuisine);
        if (unsplashResult) {
          console.log(`Found Unsplash image for "${recipeName}": ${unsplashResult}`);
          return unsplashResult;
        }
      }

      // Fallback to free APIs
      const fallbackResult = await this.searchFallbackApis(recipeName);
      if (fallbackResult) {
        console.log(`Found fallback image for "${recipeName}": ${fallbackResult}`);
        return fallbackResult;
      }

      // If all else fails, return a default food image
      const defaultImage = this.getDefaultFoodImage(recipeName, cuisine);
      console.log(`Using default image for "${recipeName}": ${defaultImage}`);
      return defaultImage;
    } catch (error) {
      console.error('Error searching for recipe image:', error);
      return this.getDefaultFoodImage(recipeName, cuisine);
    }
  }

  /**
   * Search Google Custom Search for recipe images
   */
  async searchGoogleImages(recipeName, cuisine) {
    try {
      const searchTerms = this.buildGoogleSearchTerms(recipeName, cuisine);
      
      for (const searchTerm of searchTerms) {
        console.log(`Searching Google Images for: "${searchTerm}"`);
        
        const response = await axios.get(this.googleSearchUrl, {
          params: {
            key: this.googleApiKey,
            cx: this.googleSearchEngineId,
            q: searchTerm,
            searchType: 'image',
            imgSize: 'medium',
            imgType: 'photo',
            safe: 'active',
            num: 10,
            fileType: 'jpg,jpeg,png',
            rights: 'cc_publicdomain,cc_attribute,cc_sharealike,cc_noncommercial,cc_nonderived'
          },
          timeout: 8000
        });

        if (response.data.items && response.data.items.length > 0) {
          // Filter images to get the best quality ones
          const validImages = response.data.items.filter(item => 
            item.link && 
            item.link.match(/\.(jpg|jpeg|png|webp)$/i) &&
            item.image &&
            item.image.width >= 300 &&
            item.image.height >= 200
          );

          if (validImages.length > 0) {
            // Return the first valid image
            const selectedImage = validImages[0];
            return selectedImage.link;
          }
        }
      }
    } catch (error) {
      console.error('Google Custom Search API error:', error.response?.data || error.message);
    }
    return null;
  }

  /**
   * Build search terms optimized for Google Custom Search
   */
  buildGoogleSearchTerms(recipeName, cuisine) {
    const cleanRecipeName = recipeName.toLowerCase()
      .replace(/recipe|cooking|homemade|easy|quick|best|delicious/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const terms = [
      `"${cleanRecipeName}" recipe food dish`,
      `${cleanRecipeName} food recipe`,
      `${cleanRecipeName} dish cooking`,
      `${cleanRecipeName} food photography`
    ];

    if (cuisine && cuisine.trim()) {
      terms.unshift(`"${cuisine} ${cleanRecipeName}" recipe`);
      terms.unshift(`${cuisine} ${cleanRecipeName} food`);
    }

    return terms.filter(term => term.length > 3);
  }

  /**
   * Search Unsplash curated food collections for more accurate images
   */
  async searchUnsplashCollections(recipeName, cuisine) {
    try {
      // Popular food photography collections on Unsplash (verified working)
      const foodCollections = [
        '1114848', // Food & Drink
        '1065976', // Food Photography  
        '162213',  // Restaurants & Dining
        '1319040', // Food Styling
        '3178572'  // Gourmet Food
      ];

      const searchTerms = this.buildUnsplashSearchTerms(recipeName, cuisine);
      const primaryTerm = searchTerms[0]; // Use most relevant search term

      for (const collectionId of foodCollections) {
        console.log(`Searching Unsplash collection ${collectionId} for: "${primaryTerm}"`);
        
        try {
          const response = await axios.get(`${this.unsplashBaseUrl}/collections/${collectionId}/photos`, {
            params: {
              per_page: 30,
              orientation: 'landscape'
            },
            headers: {
              'Authorization': `Client-ID ${this.unsplashAccessKey}`
            },
            timeout: 5000
          });

          if (response.data && response.data.length > 0) {
            // Filter collection images for relevance to our recipe
            const relevantImages = response.data.filter(photo => {
              const description = (photo.description || '').toLowerCase();
              const altDescription = (photo.alt_description || '').toLowerCase();
              const content = `${description} ${altDescription}`;
              
              // Check if image content matches our recipe
              const recipeWords = recipeName.toLowerCase().split(' ');
              const cuisineWords = cuisine ? cuisine.toLowerCase().split(' ') : [];
              const allSearchWords = [...recipeWords, ...cuisineWords];
              
              return allSearchWords.some(word => 
                word.length > 3 && content.includes(word)
              ) && photo.width >= 600 && photo.height >= 400;
            });

            if (relevantImages.length > 0) {
              // Score and return best match
              const scoredImages = relevantImages.map(photo => ({
                ...photo,
                relevanceScore: this.calculateImageRelevance(photo, recipeName, primaryTerm)
              }));

              scoredImages.sort((a, b) => b.relevanceScore - a.relevanceScore);
              const selectedPhoto = scoredImages[0];
              
              console.log(`Selected curated image with relevance score: ${selectedPhoto.relevanceScore}`);
              return selectedPhoto.urls.regular;
            }
          }
        } catch (collectionError) {
          console.log(`Collection ${collectionId} search failed:`, collectionError.message);
          continue; // Try next collection
        }
      }
    } catch (error) {
      console.error('Unsplash Collections API error:', error.message);
    }
    return null;
  }

  /**
   * Search Unsplash for food images (enhanced version with better filtering)
   */
  async searchUnsplash(recipeName, cuisine) {
    try {
      const searchTerms = this.buildUnsplashSearchTerms(recipeName, cuisine);
      
      for (const term of searchTerms) {
        console.log(`Searching Unsplash for: "${term}"`);
        
        const response = await axios.get(`${this.unsplashBaseUrl}/search/photos`, {
          params: {
            query: term,
            per_page: 20, // Increased for better selection
            orientation: 'landscape',
            order_by: 'relevant',
            content_filter: 'low' // Allow more variety
          },
          headers: {
            'Authorization': `Client-ID ${this.unsplashAccessKey}`
          },
          timeout: 8000
        });

        if (response.data.results && response.data.results.length > 0) {
          // Enhanced filtering for high-quality food images
          const qualityImages = response.data.results.filter(photo => 
            photo.width >= 600 && 
            photo.height >= 400 &&
            photo.urls.regular &&
            photo.likes >= 5 && // Only images with some social proof
            !this.isLowQualityImage(photo) // Custom quality check
          );

          if (qualityImages.length > 0) {
            // Score images by relevance to recipe
            const scoredImages = qualityImages.map(photo => ({
              ...photo,
              relevanceScore: this.calculateImageRelevance(photo, recipeName, term)
            }));

            // Sort by relevance score and return best match
            scoredImages.sort((a, b) => b.relevanceScore - a.relevanceScore);
            const selectedPhoto = scoredImages[0];
            
            console.log(`Selected Unsplash image with relevance score: ${selectedPhoto.relevanceScore}`);
            return selectedPhoto.urls.regular;
          }
        }
      }
    } catch (error) {
      console.error('Unsplash API error:', error.response?.data || error.message);
    }
    return null;
  }

  /**
   * Check if image is low quality based on various factors
   */
  isLowQualityImage(photo) {
    const description = (photo.description || '').toLowerCase();
    const altDescription = (photo.alt_description || '').toLowerCase();
    
    // Filter out non-food related images
    const blacklistedTerms = ['person', 'people', 'man', 'woman', 'child', 'portrait', 'selfie', 'landscape', 'building', 'car', 'animal', 'text', 'logo'];
    const content = `${description} ${altDescription}`;
    
    return blacklistedTerms.some(term => content.includes(term));
  }

  /**
   * Calculate relevance score for image selection
   */
  calculateImageRelevance(photo, recipeName, searchTerm) {
    let score = 0;
    const description = (photo.description || '').toLowerCase();
    const altDescription = (photo.alt_description || '').toLowerCase();
    const content = `${description} ${altDescription}`;
    
    // Base score from likes and downloads (social proof)
    score += Math.min(photo.likes / 100, 10); // Max 10 points from likes
    score += Math.min((photo.downloads || 0) / 1000, 5); // Max 5 points from downloads
    
    // Bonus for food-related keywords in description
    const foodKeywords = ['food', 'dish', 'meal', 'recipe', 'cooking', 'cuisine', 'delicious', 'fresh', 'gourmet', 'restaurant'];
    foodKeywords.forEach(keyword => {
      if (content.includes(keyword)) score += 2;
    });
    
    // Bonus for matching recipe name words
    const recipeWords = recipeName.toLowerCase().split(' ');
    recipeWords.forEach(word => {
      if (word.length > 3 && content.includes(word)) score += 5;
    });
    
    // Bonus for professional food photography indicators
    const proKeywords = ['styled', 'photography', 'professional', 'studio', 'plated', 'garnish'];
    proKeywords.forEach(keyword => {
      if (content.includes(keyword)) score += 3;
    });
    
    // Image quality factors
    if (photo.width >= 1000 && photo.height >= 700) score += 5; // High resolution
    if (photo.width / photo.height >= 1.2 && photo.width / photo.height <= 1.8) score += 3; // Good aspect ratio
    
    return score;
  }

  /**
   * Build search terms optimized for Unsplash (Enhanced for better accuracy)
   */
  buildUnsplashSearchTerms(recipeName, cuisine) {
    const cleanRecipeName = recipeName.toLowerCase()
      .replace(/recipe|cooking|homemade|easy|quick|best|delicious|perfect|traditional/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Enhanced search terms with better food photography keywords
    const terms = [];

    // Most specific terms first (highest priority)
    if (cuisine && cuisine.trim()) {
      terms.push(`${cuisine} ${cleanRecipeName} food photography`);
      terms.push(`${cuisine} ${cleanRecipeName} dish`);
      terms.push(`${cuisine} ${cleanRecipeName}`);
    }

    // Recipe-specific terms with food photography keywords
    terms.push(`${cleanRecipeName} food photography`);
    terms.push(`${cleanRecipeName} gourmet food`);
    terms.push(`${cleanRecipeName} restaurant food`);
    terms.push(`${cleanRecipeName} food styling`);
    terms.push(`${cleanRecipeName} dish`);
    terms.push(`${cleanRecipeName} meal`);
    terms.push(`${cleanRecipeName} food`);

    // Fallback to general food category if recipe name is very specific
    if (this.getFoodCategory(cleanRecipeName)) {
      terms.push(`${this.getFoodCategory(cleanRecipeName)} food photography`);
    }

    return terms.filter(term => term.length > 2);
  }

  /**
   * Get food category for better fallback searches
   */
  getFoodCategory(recipeName) {
    const categories = {
      // Proteins
      'chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|turkey': 'protein',
      // Pasta & Rice
      'pasta|spaghetti|noodle|rice|risotto|biryani': 'pasta rice',
      // Soups & Stews
      'soup|stew|broth|curry|chili': 'soup stew',
      // Desserts
      'cake|cookie|pie|dessert|ice cream|chocolate|sweet': 'dessert',
      // Breakfast
      'pancake|waffle|eggs|breakfast|cereal|toast': 'breakfast',
      // Vegetables
      'salad|vegetable|veggie|green|healthy': 'salad vegetable',
      // Bread & Baked
      'bread|pizza|sandwich|burger|baked': 'bread baked'
    };

    for (const [keywords, category] of Object.entries(categories)) {
      if (new RegExp(keywords, 'i').test(recipeName)) {
        return category;
      }
    }
    return null;
  }

  /**
   * Search fallback APIs for food images
   */
  async searchFallbackApis(recipeName) {
    try {
      console.log(`Using fallback API for: "${recipeName}"`);
      
      // Try to get a more specific image based on recipe analysis
      const specificImage = this.getSpecificFoodImage(recipeName);
      if (specificImage) {
        console.log(`Found specific image for "${recipeName}": ${specificImage}`);
        return specificImage;
      }
      
      // Use Foodish API for random food images
      const response = await axios.get('https://foodish-api.herokuapp.com/api/', {
        timeout: 5000
      });

      if (response.data && response.data.image) {
        return response.data.image;
      }
    } catch (error) {
      console.error('Fallback API error:', error.message);
    }
    return null;
  }

  /**
   * Get specific food image based on detailed recipe name analysis
   */
  getSpecificFoodImage(recipeName) {
    const recipeNameLower = recipeName.toLowerCase();
    
    // Detailed food type mapping
    const specificImages = {
      // Proteins
      'chicken': 'https://images.unsplash.com/photo-1598103442097-8138fb71fb3d?w=500&h=300&fit=crop',
      'beef': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&h=300&fit=crop',
      'pork': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&h=300&fit=crop',
      'fish': 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=500&h=300&fit=crop',
      'salmon': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=500&h=300&fit=crop',
      'shrimp': 'https://images.unsplash.com/photo-1565680018434-b513d5573b07?w=500&h=300&fit=crop',
      'lamb': 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=500&h=300&fit=crop',
      
      // Popular dishes
      'pasta': 'https://images.unsplash.com/photo-1621996346565-e3dbc353d843?w=500&h=300&fit=crop',
      'spaghetti': 'https://images.unsplash.com/photo-1621996346565-e3dbc353d843?w=500&h=300&fit=crop',
      'pizza': 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=300&fit=crop',
      'burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&h=300&fit=crop',
      'sandwich': 'https://images.unsplash.com/photo-1553909489-cd47e0ef937f?w=500&h=300&fit=crop',
      'soup': 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500&h=300&fit=crop',
      'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&h=300&fit=crop',
      'steak': 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&h=300&fit=crop',
      'tacos': 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=500&h=300&fit=crop',
      'curry': 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&h=300&fit=crop',
      'risotto': 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=500&h=300&fit=crop',
      
      // Desserts
      'cake': 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&h=300&fit=crop',
      'pie': 'https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=500&h=300&fit=crop',
      'cookies': 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&h=300&fit=crop',
      'brownies': 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&h=300&fit=crop',
      'ice cream': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&h=300&fit=crop',
      'chocolate': 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=500&h=300&fit=crop',
      
      // Breakfast items
      'pancakes': 'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?w=500&h=300&fit=crop',
      'waffles': 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?w=500&h=300&fit=crop',
      'eggs': 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=500&h=300&fit=crop',
      'bacon': 'https://images.unsplash.com/photo-1528607929212-2636ec44b982?w=500&h=300&fit=crop',
      'toast': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&h=300&fit=crop',
      
      // Specific cuisines dishes
      'ramen': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&h=300&fit=crop',
      'sushi': 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&h=300&fit=crop',
      'pad thai': 'https://images.unsplash.com/photo-1559847844-d721426d6edc?w=500&h=300&fit=crop',
      'biryani': 'https://images.unsplash.com/photo-1563379091339-03246963d7d3?w=500&h=300&fit=crop',
      'paella': 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=500&h=300&fit=crop'
    };
    
    // Find the best match
    for (const [keyword, imageUrl] of Object.entries(specificImages)) {
      if (recipeNameLower.includes(keyword)) {
        return imageUrl;
      }
    }
    
    return null;
  }

  /**
   * Get a default food image based on cuisine or recipe type (enhanced)
   */
  getDefaultFoodImage(recipeName, cuisine) {
    const defaultImages = {
      // Cuisine-specific defaults
      italian: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=300&fit=crop',
      mexican: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=500&h=300&fit=crop',
      asian: 'https://images.unsplash.com/photo-1563379091339-03246963d7d3?w=500&h=300&fit=crop',
      indian: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&h=300&fit=crop',
      mediterranean: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=500&h=300&fit=crop',
      american: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&h=300&fit=crop',
      french: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&h=300&fit=crop',
      thai: 'https://images.unsplash.com/photo-1559847844-d721426d6edc?w=500&h=300&fit=crop',
      chinese: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&h=300&fit=crop',
      japanese: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&h=300&fit=crop',
      
      // Recipe type defaults
      pasta: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d843?w=500&h=300&fit=crop',
      pizza: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=300&fit=crop',
      burger: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&h=300&fit=crop',
      soup: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=500&h=300&fit=crop',
      salad: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&h=300&fit=crop',
      chicken: 'https://images.unsplash.com/photo-1598103442097-8138fb71fb3d?w=500&h=300&fit=crop',
      beef: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&h=300&fit=crop',
      fish: 'https://images.unsplash.com/photo-1544943910-4c1dc44aab44?w=500&h=300&fit=crop',
      dessert: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=500&h=300&fit=crop',
      cake: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&h=300&fit=crop',
      bread: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&h=300&fit=crop'
    };

    // Check if cuisine matches any default
    const cuisineLower = cuisine.toLowerCase();
    if (defaultImages[cuisineLower]) {
      return defaultImages[cuisineLower];
    }

    // Check recipe name for type hints
    const recipeNameLower = recipeName.toLowerCase();
    for (const [recipeType, imageUrl] of Object.entries(defaultImages)) {
      if (recipeNameLower.includes(recipeType)) {
        return imageUrl;
      }
    }

    // Generic food image as last resort
    return 'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=500&h=300&fit=crop';
  }

  /**
   * Validate if an image URL is accessible
   */
  async validateImageUrl(imageUrl) {
    try {
      const response = await axios.head(imageUrl, { timeout: 3000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

module.exports = new ImageService();
