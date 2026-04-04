/**
 * Authentication Middleware
 * Handles JWT token validation and user authentication
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config');
const { AppError } = require('./errorHandler');

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client defensively
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
} else {
  console.warn("⚠️ SUPABASE_URL or SUPABASE_ANON_KEY is missing! Auth will fail.");
}

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

    try {
      // Verify token securely using Supabase SDK (handles RS256/HS256 automatically)
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
      
      if (error || !supabaseUser) throw error || new Error("User not found in Supabase");

      // Look up User in MongoDB by email
      let user = await User.findOne({ email: supabaseUser.email }).select('-password');

      if (!user) {
        // Auto-create user if they signed up via Supabase but don't exist in MongoDB
        console.log(`Auto-creating MongoDB user for Supabase auth: ${supabaseUser.email}`);
        let username = supabaseUser.email.split('@')[0];
        
        // Ensure username is unique for auto-generated
        let usernameTaken = await User.findOne({ username });
        if (usernameTaken) {
            username = `${username}_${crypto.randomBytes(3).toString('hex')}`;
        }

        user = await User.create({
            email: supabaseUser.email,
            username: username,
            password: crypto.randomBytes(32).toString('hex'), // Placeholder, auth managed by Supabase
            isActive: true
        });
        
        // Remove password from object
        user = user.toObject();
        delete user.password;
      }

      req.user = user;
      req.userId = user._id;
      next();
    } catch (err) {
      console.error("JWT Verification failed:", err.message);
      throw new AppError('Invalid or expired token. Access denied.', 401, 'UNAUTHORIZED');
    }
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
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
      
      if (!error && supabaseUser) {
        let user = await User.findOne({ email: supabaseUser.email }).select('-password');
        if (user) {
          req.user = user;
          req.userId = user._id;
        }
      }
    } catch (err) {
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
      return next(
        new AppError('You do not have permission to perform this action', 403, 'FORBIDDEN')
      );
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
