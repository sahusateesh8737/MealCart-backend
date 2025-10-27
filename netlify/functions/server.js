// netlify/functions/server.js - Netlify serverless function handler
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('../../routes/auth');
const recipeRoutes = require('../../routes/recipes');
const groceryListRoutes = require('../../routes/grocerylist');
const geminiRoutes = require('../../routes/gemini');
const aiRoutes = require('../../routes/ai');
const userRoutes = require('../../routes/users');
const enhancedRecipeRoutes = require('../../routes/recipes_enhanced');

const app = express();

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app';

console.log('[Netlify Function] Starting server...');
console.log('[Netlify Function] MongoDB configured:', !!MONGODB_URI);
console.log('[Netlify Function] Frontend URL:', FRONTEND_URL);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      FRONTEND_URL,
      'https://meal-cart-phi.vercel.app',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000'
    ];
    
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for Netlify
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-CSRF-Token', 'X-Api-Version'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// MongoDB connection
let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('[DB] Using cached MongoDB connection');
    return cachedConnection;
  }

  if (!MONGODB_URI) {
    console.warn('[DB] MONGODB_URI not configured');
    return null;
  }

  try {
    const options = {
      bufferCommands: false,
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    
    console.log('[DB] Connecting to MongoDB...');
    const connection = await mongoose.connect(MONGODB_URI, options);
    cachedConnection = connection;
    console.log('[DB] Connected to MongoDB successfully');
    return connection;
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    throw error;
  }
}

// Root route
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'MealCart Backend API is running',
    version: '1.0.0',
    platform: 'Netlify Functions',
    healthCheck: '/api/health',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      platform: 'Netlify Functions',
      environment: process.env.NODE_ENV || 'production'
    });
  } catch (error) {
    console.error('[Health] Database check failed:', error.message);
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString(),
      platform: 'Netlify Functions',
      environment: process.env.NODE_ENV || 'production'
    });
  }
});

// Connect to database on first request
app.use(async (req, res, next) => {
  try {
    if (MONGODB_URI) {
      await connectToDatabase();
    }
    next();
  } catch (error) {
    console.error('[Middleware] DB connection error:', error.message);
    next();
  }
});

// Handle OPTIONS requests
app.options('/api/*', cors(corsOptions));

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
    console.error('[Proxy] Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error]', err.message, err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Export for Netlify
module.exports = app;
