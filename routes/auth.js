const express = require('express');
const authController = require('../controllers/authController');

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
router.post('/register', authController.register);

// Login user
router.post('/login', authController.login);

// Verify token and get user info
router.get('/me', authController.getCurrentUser);

module.exports = router;
