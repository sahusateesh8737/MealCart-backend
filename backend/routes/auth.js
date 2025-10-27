const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger } = require('../utils/logger');

const router = express.Router();

// Handle preflight OPTIONS requests for all auth routes
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://meal-cart-phi.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Register user
router.post('/register', async (req, res) => {
  const startTime = Date.now();
  try {
    const { username, email, password } = req.body;

    logger.logUserActivity('REGISTRATION_ATTEMPT', req, null, {
      username,
      email: email ? `${email.charAt(0)}***@${email.split('@')[1]}` : null
    });

    // Validation
    if (!username || !email || !password) {
      logger.warn('Registration failed - missing fields', {
        missingFields: {
          username: !username,
          email: !email,
          password: !password
        }
      });
      return res.status(400).json({ 
        message: 'All fields are required',
        error: 'MISSING_FIELDS'
      });
    }

    if (password.length < 6) {
      logger.warn('Registration failed - invalid password length', {
        passwordLength: password.length
      });
      return res.status(400).json({ 
        message: 'Password must be at least 6 characters long',
        error: 'INVALID_PASSWORD'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      logger.warn('Registration failed - user already exists', {
        field,
        existingUserId: existingUser._id
      });
      return res.status(400).json({ 
        message: `User with this ${field} already exists`,
        error: 'USER_EXISTS'
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const processingTime = Date.now() - startTime;
    logger.logUserActivity('REGISTRATION_SUCCESS', req, user._id, {
      username,
      email: `${email.charAt(0)}***@${email.split('@')[1]}`,
      processingTime: `${processingTime}ms`
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.logError(error, req, {
      action: 'REGISTRATION',
      processingTime: `${processingTime}ms`
    });
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: 'Validation error',
        errors,
        error: 'VALIDATION_ERROR'
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `${field} already exists`,
        error: 'DUPLICATE_FIELD'
      });
    }

    res.status(500).json({ 
      message: 'Server error during registration',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const startTime = Date.now();
  try {
    const { email, password } = req.body;

    logger.logUserActivity('LOGIN_ATTEMPT', req, null, {
      email: email ? `${email.charAt(0)}***@${email.split('@')[1]}` : null
    });

    // Validation
    if (!email || !password) {
      logger.warn('Login failed - missing credentials', {
        hasEmail: !!email,
        hasPassword: !!password
      });
      return res.status(400).json({ 
        message: 'Email and password are required',
        error: 'MISSING_FIELDS'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      logger.warn('Login failed - user not found', {
        email: `${email.charAt(0)}***@${email.split('@')[1]}`
      });
      return res.status(401).json({ 
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      logger.warn('Login failed - invalid password', {
        userId: user._id,
        email: `${email.charAt(0)}***@${email.split('@')[1]}`
      });
      return res.status(401).json({ 
        message: 'Invalid email or password',
        error: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login
    const previousLogin = user.lastLogin;
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const processingTime = Date.now() - startTime;
    logger.logUserActivity('LOGIN_SUCCESS', req, user._id, {
      username: user.username,
      email: `${email.charAt(0)}***@${email.split('@')[1]}`,
      previousLogin,
      processingTime: `${processingTime}ms`
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        lastLogin: user.lastLogin,
        preferences: user.preferences
      }
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.logError(error, req, {
      action: 'LOGIN',
      processingTime: `${processingTime}ms`
    });
    res.status(500).json({ 
      message: 'Server error during login',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Verify token and get user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Token verification failed - no token provided', {
        hasAuthHeader: !!authHeader,
        authHeaderFormat: authHeader ? 'Bearer token' : 'none'
      });
      return res.status(401).json({ 
        message: 'No token provided',
        error: 'UNAUTHORIZED'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      logger.warn('Token verification failed - user not found', {
        decodedUserId: decoded.userId
      });
      return res.status(401).json({ 
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
    }

    logger.logUserActivity('TOKEN_VERIFICATION_SUCCESS', req, user._id, {
      username: user.username,
      lastLogin: user.lastLogin
    });

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        preferences: user.preferences
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Token verification failed - invalid token', {
        error: error.message
      });
      return res.status(401).json({ 
        message: 'Invalid token',
        error: 'INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      logger.warn('Token verification failed - token expired', {
        expiredAt: error.expiredAt
      });
      return res.status(401).json({ 
        message: 'Token expired',
        error: 'TOKEN_EXPIRED'
      });
    }

    logger.logError(error, req, {
      action: 'TOKEN_VERIFICATION'
    });
    res.status(500).json({ 
      message: 'Server error during token verification',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
