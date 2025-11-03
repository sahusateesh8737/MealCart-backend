/**
 * Request Validation Middleware
 * Validates and sanitizes incoming requests
 */

const { AppError } = require('./errorHandler');

/**
 * Validate required fields in request body
 */
const validateRequired = (fields) => {
  return (req, res, next) => {
    const missingFields = [];

    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return next(
        new AppError(
          `Missing required fields: ${missingFields.join(', ')}`,
          400,
          'MISSING_REQUIRED_FIELDS'
        )
      );
    }

    next();
  };
};

/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      return next(
        new AppError(
          `Invalid ${paramName} format`,
          400,
          'INVALID_ID'
        )
      );
    }

    next();
  };
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters long' };
  }
  // Add more validation as needed
  return { valid: true };
};

/**
 * Sanitize user input to prevent XSS
 */
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove < and > to prevent basic XSS
      .slice(0, 10000); // Limit string length
  }
  return input;
};

/**
 * Sanitize request body
 */
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      req.body[key] = sanitizeInput(req.body[key]);
    }
  }
  next();
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;

  if (page < 1) {
    return next(new AppError('Page must be greater than 0', 400, 'INVALID_PAGE'));
  }

  if (limit < 1 || limit > 100) {
    return next(new AppError('Limit must be between 1 and 100', 400, 'INVALID_LIMIT'));
  }

  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit,
  };

  next();
};

/**
 * Validate query parameters for recipe search
 */
const validateRecipeSearch = (req, res, next) => {
  const { query, ingredients } = req.query;

  if (!query && !ingredients) {
    return next(
      new AppError(
        'Either query or ingredients parameter is required',
        400,
        'MISSING_SEARCH_PARAMS'
      )
    );
  }

  next();
};

module.exports = {
  validateRequired,
  validateObjectId,
  validateEmail,
  validatePassword,
  sanitizeInput,
  sanitizeBody,
  validatePagination,
  validateRecipeSearch,
};
