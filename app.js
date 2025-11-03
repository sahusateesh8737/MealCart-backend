/**
 * Express Application Bootstrap
 * Configures and exports the Express app instance
 */

const express = require('express');
const config = require('./config');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { securityHeaders, preventMongoInjection, apiRateLimiter } = require('./middleware/security');
const corsMiddleware = require('./middleware/cors');

// Import routes
const authRoutes = require('./routes/auth');
const recipeRoutes = require('./routes/recipes');
const enhancedRecipeRoutes = require('./routes/recipes_enhanced');
const groceryListRoutes = require('./routes/grocerylist');
const geminiRoutes = require('./routes/gemini');
const aiRoutes = require('./routes/ai');
const userRoutes = require('./routes/users');

/**
 * Create and configure Express application
 */
function createApp() {
  const app = express();

  // Trust proxy (required for rate limiting behind proxies like Nginx, Vercel, etc.)
  if (config.security.trustProxy) {
    app.set('trust proxy', 1);
  }

  // Security middleware (should be first)
  app.use(securityHeaders);
  app.use(preventMongoInjection);

  // CORS middleware
  app.use(corsMiddleware);

  // Body parsing middleware
  app.use(express.json({ limit: config.server.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.server.bodyLimit }));

  // Rate limiting (apply globally, but can be overridden per route)
  if (config.isProduction) {
    app.use('/api/', apiRateLimiter);
  }

  // Request logging middleware (custom or morgan)
  if (config.isDevelopment) {
    app.use((req, res, next) => {
      console.log(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  // Health check endpoint (no auth required)
  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'MealCart Backend API is healthy',
      timestamp: new Date().toISOString(),
      environment: config.env,
      version: '1.0.0',
    });
  });

  // API v1 routes
  const apiRouter = express.Router();
  
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/recipes', recipeRoutes);
  apiRouter.use('/recipes-enhanced', enhancedRecipeRoutes);
  apiRouter.use('/grocerylist', groceryListRoutes);
  apiRouter.use('/gemini', geminiRoutes);
  apiRouter.use('/ai', aiRoutes);
  apiRouter.use('/users', userRoutes);

  // Health check within API
  apiRouter.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'API is healthy',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Root route
  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'MealCart Backend API',
      version: '1.0.0',
      documentation: '/api/docs',
      health: '/health',
      environment: config.env,
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler (must be after all routes)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
