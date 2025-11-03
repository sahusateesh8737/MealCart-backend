/**
 * Security Middleware
 * Implements security best practices for the application
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const config = require('../config');

/**
 * Rate limiting middleware
 */
const createRateLimiter = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || config.rateLimit.windowMs,
    max: options.max || config.rateLimit.max,
    standardHeaders: config.rateLimit.standardHeaders,
    legacyHeaders: config.rateLimit.legacyHeaders,
    message: options.message || config.rateLimit.message,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          message: options.message || config.rateLimit.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: req.rateLimit.resetTime,
        },
      });
    },
    skip: (req) => {
      // Skip rate limiting for health check endpoints
      return req.path === '/health' || req.path === '/api/health';
    },
  });
};

/**
 * Strict rate limiter for authentication endpoints
 */
const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many authentication attempts, please try again later.',
});

/**
 * Standard API rate limiter
 */
const apiRateLimiter = createRateLimiter();

/**
 * Helmet security headers
 */
const securityHeaders = helmet({
  contentSecurityPolicy: config.security.helmet.contentSecurityPolicy,
  crossOriginEmbedderPolicy: config.security.helmet.crossOriginEmbedderPolicy,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * MongoDB injection prevention
 */
const preventMongoInjection = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️  Potential MongoDB injection attempt detected`, {
      ip: req.ip,
      path: req.path,
      key,
    });
  },
});

/**
 * Request size limiter
 */
const requestSizeLimiter = (req, res, next) => {
  const contentLength = parseInt(req.get('content-length') || 0);
  const maxSize = config.upload.maxSize;

  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      error: {
        message: `Request payload too large. Maximum size is ${maxSize / (1024 * 1024)}MB`,
        code: 'PAYLOAD_TOO_LARGE',
      },
    });
  }

  next();
};

/**
 * IP whitelist/blacklist middleware (if needed)
 */
const ipFilter = (options = {}) => {
  const whitelist = options.whitelist || [];
  const blacklist = options.blacklist || [];

  return (req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;

    // Check blacklist first
    if (blacklist.length > 0 && blacklist.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
          code: 'IP_BLACKLISTED',
        },
      });
    }

    // Check whitelist if configured
    if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
          code: 'IP_NOT_WHITELISTED',
        },
      });
    }

    next();
  };
};

/**
 * API Key validation middleware (for external service access)
 */
const validateApiKey = (req, res, next) => {
  const apiKey = req.header('X-API-Key');

  if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid or missing API key',
        code: 'INVALID_API_KEY',
      },
    });
  }

  next();
};

module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
  securityHeaders,
  preventMongoInjection,
  requestSizeLimiter,
  ipFilter,
  validateApiKey,
};
