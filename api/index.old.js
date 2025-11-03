// api/index.js - Minimal serverless function for Vercel
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Create Express app
const app = express();

// Environment variables with fallbacks
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app';

console.log('[Init] MongoDB URI available:', !!MONGODB_URI);
console.log('[Init] Frontend URL:', FRONTEND_URL);

// CORS configuration
const corsOptions = {
  origin: [
    FRONTEND_URL,
    'https://meal-cart-phi.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// MongoDB connection
let cachedConnection = null;

async function connectToDatabase() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('[DB] Using cached connection');
    return cachedConnection;
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };
    
    console.log('[DB] Connecting to MongoDB...');
    const connection = await mongoose.connect(MONGODB_URI, opts);
    cachedConnection = connection;
    console.log('[DB] Connected to MongoDB successfully');
    return connection;
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    throw error;
  }
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    if (MONGODB_URI) {
      await connectToDatabase();
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: 'connected',
        environment: process.env.NODE_ENV || 'development'
      });
    } else {
      res.json({ 
        status: 'partial', 
        timestamp: new Date().toISOString(),
        database: 'not configured',
        message: 'Server running but no database connection configured',
        environment: process.env.NODE_ENV || 'development'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// Basic routes
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// Recipes routes (simplified)
app.get('/api/recipes', async (req, res) => {
  try {
    if (!MONGODB_URI) {
      return res.json({ 
        message: 'Recipes endpoint working (no database configured)',
        recipes: [],
        timestamp: new Date().toISOString()
      });
    }
    
    await connectToDatabase();
    
    // For now, return a simple response
    res.json({ 
      message: 'Recipes endpoint working',
      recipes: [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[API] Recipes error:', error);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`[404] ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Export for Vercel
module.exports = app;
