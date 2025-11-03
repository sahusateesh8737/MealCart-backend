const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const fetch = require('node-fetch');

// Load environment variables FIRST
dotenv.config();

// Custom CORS middleware
const corsMiddleware = require('./middleware/cors');

// Import logging utilities
const { logger } = require('./utils/logger');
const { requestLogger, errorLogger } = require('./middleware/logging');

// Debug: Check if environment variables are loaded
logger.info('Starting MealCart Backend Server');
logger.info('Environment variables loaded:', {
  geminiApiKey: !!process.env.GEMINI_API_KEY,
  mongodbUri: !!process.env.MONGODB_URI,
  jwtSecret: !!process.env.JWT_SECRET,
  unsplashAccessKey: !!process.env.UNSPLASH_ACCESS_KEY,
  frontendUrl: process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app',
  nodeEnv: process.env.NODE_ENV
});

// Import routes
const authRoutes = require('./routes/auth');
const recipeRoutes = require('./routes/recipes');
const groceryListRoutes = require('./routes/grocerylist');
const geminiRoutes = require('./routes/gemini');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/users');
const enhancedRecipeRoutes = require('./routes/recipes_enhanced');

const app = express();

// Define CORS options once so they're consistent throughout the app
const corsOptions = {
  origin: function (origin, callback) {
    // List of allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app',
      'http://localhost:5173', // Vite development server
      'http://localhost:5174', // Alternative Vite port
      'http://localhost:3000', // React default development server
      'http://192.168.29.216:5173', // Mobile access - frontend
      'http://192.168.29.216:5174', // Mobile access - alternative frontend
      'http://192.168.29.216:3000'  // Mobile access - React default
    ];
    
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation: Origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-CSRF-Token', 'X-Api-Version'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200 // Using 200 instead of 204 for maximum browser compatibility
};

// Enable standard CORS middleware
app.use(cors(corsOptions));

// Apply our custom CORS middleware for extra handling
app.use(corsMiddleware);

// Add request logging middleware
app.use(requestLogger);

// Regular middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB with optimized settings for serverless environments
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 10 // Optimized for serverless functions
})
.then(() => {
  logger.info('Connected to MongoDB successfully');
})
.catch((error) => {
  logger.error('MongoDB connection error', { error: error.message, stack: error.stack });
  // Don't exit the process in production, as serverless functions should return a response
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

// Special handling for OPTIONS requests to auth endpoints
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

// Proxy route to fetch total users
app.get('/api/proxy/totalusers', async (req, res) => {
  try {
    const response = await fetch('https://sc.ecombullet.com/api/dashboard/totalusers');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'MealCart Backend API is running',
    version: '1.0.0',
    healthCheck: '/api/health',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    message: 'MealCart Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use(errorLogger);
app.use((err, req, res, next) => {
  logger.error('Unhandled application error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

// Function to find available port
// Check if running directly or being imported
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  const findAvailablePort = async (startPort) => {
    return new Promise((resolve, reject) => {
      const server = app.listen(startPort, '0.0.0.0', () => {
        if (server.address() === null) {
          // Port not available, try next port
          const nextPort = startPort + 1;
          console.log(`Port ${startPort} not available, trying ${nextPort}...`);
          findAvailablePort(nextPort).then(resolve).catch(reject);
        } else {
          const actualPort = server.address().port;
          logger.info(`Server started successfully`, {
            port: actualPort,
            environment: process.env.NODE_ENV || 'development',
            healthCheck: `http://localhost:${actualPort}/api/health`,
            mobileAccess: `http://192.168.29.216:${actualPort}/api/health`
          });
          resolve(server);
        }
      });
    });
  };

  // Start server with port fallback
  findAvailablePort(PORT).catch((error) => {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  });
} else {
  // Being imported (likely by Vercel), export the app
  logger.info('Exporting Express app for serverless deployment');
}

// Export for serverless environments like Vercel
module.exports = app;
