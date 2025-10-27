const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Use serverless logger if in serverless environment, otherwise use full logger
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
const { logger } = isServerless 
  ? require('./utils/serverless-logger') 
  : require('./utils/logger');

// Only import logging middleware if not in serverless (to avoid file system issues)
let requestLogger, errorLogger;
if (!isServerless) {
  try {
    const logging = require('./middleware/logging');
    requestLogger = logging.requestLogger;
    errorLogger = logging.errorLogger;
  } catch (error) {
    console.log('Using simplified logging for serverless environment');
    // Simplified middleware for serverless
    requestLogger = (req, res, next) => {
      console.log(`${req.method} ${req.url} from ${req.headers.origin || 'unknown'}`);
      next();
    };
    errorLogger = (err, req, res, next) => {
      console.error('Error:', err.message);
      next(err);
    };
  }
} else {
  // Simplified middleware for serverless
  requestLogger = (req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  };
  errorLogger = (err, req, res, next) => {
    console.error('Error:', err.message);
    next(err);
  };
}

// Import CORS middleware with fallback
let corsMiddleware;
try {
  corsMiddleware = require('./middleware/cors');
} catch (error) {
  console.log('Using simplified CORS for serverless');
  corsMiddleware = (req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app',
      'https://meal-cart-phi.vercel.app'
    ];
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  };
}

// Import routes
const authRoutes = require('./routes/auth');
const recipeRoutes = require('./routes/recipes');
const groceryListRoutes = require('./routes/grocerylist');
const geminiRoutes = require('./routes/gemini');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/users');
const enhancedRecipeRoutes = require('./routes/recipes_enhanced');

const app = express();

// Log startup info
if (isServerless) {
  console.log('Starting MealCart Backend in Serverless Mode');
} else {
  logger.info('Starting MealCart Backend Server');
  logger.info('Environment variables loaded:', {
    geminiApiKey: !!process.env.GEMINI_API_KEY,
    mongodbUri: !!process.env.MONGODB_URI,
    jwtSecret: !!process.env.JWT_SECRET,
    unsplashAccessKey: !!process.env.UNSPLASH_ACCESS_KEY,
    frontendUrl: process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app',
    nodeEnv: process.env.NODE_ENV
  });
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app',
      'https://meal-cart-phi.vercel.app',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000'
    ];
    
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(new Error('CORS policy violation: Origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-CSRF-Token', 'X-Api-Version'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// Apply middleware
app.use(cors(corsOptions));
app.use(corsMiddleware);
app.use(requestLogger);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB connection with serverless optimization
const connectDB = async () => {
  try {
    const options = {
      serverSelectionTimeoutMS: isServerless ? 5000 : 30000,
      maxPoolSize: isServerless ? 5 : 10,
      bufferCommands: false
    };
    
    await mongoose.connect(process.env.MONGODB_URI, options);
    
    if (isServerless) {
      console.log('Connected to MongoDB (Serverless)');
    } else {
      logger.info('Connected to MongoDB successfully');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    if (!isServerless) {
      logger.error('MongoDB connection error', { error: error.message, stack: error.stack });
    }
    // Don't exit in serverless environment
    if (!isServerless && process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

// Connect to database
connectDB();

// Health check route (moved up for priority)
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    message: 'MealCart Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    serverless: isServerless
  });
});

// Handle OPTIONS for auth routes
app.options('/api/auth/*', (req, res) => {
  res.status(200).end();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/recipes-enhanced', enhancedRecipeRoutes);
app.use('/api/grocerylist', groceryListRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', userRoutes);

// Proxy route
app.get('/api/proxy/totalusers', async (req, res) => {
  try {
    const fetch = require('node-fetch');
    const response = await fetch('https://sc.ecombullet.com/api/dashboard/totalusers');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Error handling
app.use(errorLogger);
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Local server startup (only if not in serverless)
if (!isServerless && require.main === module) {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for serverless
module.exports = app;
