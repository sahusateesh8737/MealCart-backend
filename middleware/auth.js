/**
 * Authentication Middleware
 * Handles JWT token validation and user authentication
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { AppError } = require('./errorHandler');

/**
 * Verify JWT token and attach user to request
 */
const authRequired = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided. Access denied.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.substring(7);

    if (!token) {
      throw new AppError('No token provided. Access denied.', 401, 'UNAUTHORIZED');
    }

    const decoded = jwt.verify(token, config.auth.jwtSecret);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      throw new AppError('User not found. Access denied.', 401, 'USER_NOT_FOUND');
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user) {
        req.user = user;
        req.userId = user._id;
      }
    } catch (jwtError) {
      console.log('Optional auth - invalid/expired token (ignored)');
    }
    
    next();
  } catch (error) {
    next();
  }
};

/**
 * Role-based access control middleware
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN'));
    }

    next();
  };
};

/**
 * Check if user owns the resource
 * @param {string} resourceIdParam - Name of the parameter containing resource ID
 */
const checkOwnership = (resourceIdParam = 'id') => {
  return (req, res, next) => {
    const resourceId = req.params[resourceIdParam];
    const userId = req.userId?.toString();

    if (!userId) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    req.resourceId = resourceId;
    next();
  };
};

module.exports = { 
  auth: authRequired,
  authRequired,
  optional: optionalAuth,
  optionalAuth,
  authorize,
  checkOwnership,
};
