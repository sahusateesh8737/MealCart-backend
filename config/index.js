/**
 * Central Configuration Module
 * Manages all application configuration with validation and defaults
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

/**
 * Validate required environment variables
 * @throws {Error} if any required variable is missing
 */
const validateEnv = () => {
  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
    'GEMINI_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT_SECRET strength
  if (process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  WARNING: JWT_SECRET should be at least 32 characters for production use');
  }
};

const config = {
  // Environment
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
  isServerless: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY),

  // Server
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || '0.0.0.0',
    apiVersion: 'v1',
    bodyLimit: process.env.BODY_LIMIT || '10mb',
    corsMaxAge: 86400, // 24 hours
  },

  // Database
  database: {
    uri: process.env.MONGODB_URI,
    options: {
      maxPoolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
      serverSelectionTimeoutMS: parseInt(process.env.DB_TIMEOUT, 10) || 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    },
    debug: process.env.DB_DEBUG === 'true',
  },

  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
    tokenHeader: 'Authorization',
    tokenPrefix: 'Bearer',
  },

  // External APIs
  apis: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
      fallbackModel: 'gemini-1.5-flash',
      maxRetries: 3,
      timeout: 30000,
    },
    spoonacular: {
      apiKey: process.env.SPOONACULAR_API_KEY,
      baseUrl: 'https://api.spoonacular.com',
      timeout: 10000,
    },
    unsplash: {
      accessKey: process.env.UNSPLASH_ACCESS_KEY,
      baseUrl: 'https://api.unsplash.com',
      timeout: 5000,
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
    },
  },

  // CORS Configuration
  cors: {
    allowedOrigins: [
      process.env.FRONTEND_URL || 'https://meal-cart-phi.vercel.app',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://192.168.29.216:5173',
      'http://192.168.29.216:5174',
      'http://192.168.29.216:3000',
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-CSRF-Token',
      'X-Api-Version',
    ],
    credentials: true,
    maxAge: 86400,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    dir: process.env.LOG_DIR || path.join(__dirname, '..', 'logs'),
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    format: process.env.LOG_FORMAT || 'json',
    colorize: process.env.LOG_COLORIZE !== 'false',
  },

  // Security
  security: {
    helmet: {
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    },
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production',
  },

  // File Upload
  upload: {
    maxSize: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },

  // Pagination
  pagination: {
    defaultLimit: 12,
    maxLimit: 100,
  },

  // Cache
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 3600, // 1 hour
    enabled: process.env.CACHE_ENABLED !== 'false',
  },
};

// Validate environment on load (only in non-test environments)
if (process.env.NODE_ENV !== 'test') {
  try {
    validateEnv();
  } catch (error) {
    console.error('❌ Configuration Error:', error.message);
    process.exit(1);
  }
}

module.exports = config;
