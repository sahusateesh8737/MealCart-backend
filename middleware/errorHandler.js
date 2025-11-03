/**
 * Global Error Handler Middleware
 * Centralized error handling for the application
 */

const config = require('../config');

/**
 * Custom Application Error Class
 */
class AppError extends Error {
  constructor(message, statusCode, errorCode = 'INTERNAL_ERROR', isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error response formatter
 */
const formatErrorResponse = (err, req) => {
  const response = {
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.errorCode || 'INTERNAL_ERROR',
      timestamp: err.timestamp || new Date().toISOString(),
    },
  };

  // Add stack trace in development
  if (config.isDevelopment && err.stack) {
    response.error.stack = err.stack;
  }

  // Add request details in development
  if (config.isDevelopment) {
    response.error.request = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    };
  }

  // Add validation errors if present
  if (err.errors) {
    response.error.details = err.errors;
  }

  return response;
};

/**
 * Handle MongoDB/Mongoose errors
 */
const handleMongooseError = (err) => {
  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return new AppError(
      `${field} already exists`,
      400,
      'DUPLICATE_FIELD'
    );
  }

  // Validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
    const error = new AppError(
      'Validation failed',
      400,
      'VALIDATION_ERROR'
    );
    error.errors = errors;
    return error;
  }

  // Cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return new AppError(
      `Invalid ${err.path}: ${err.value}`,
      400,
      'INVALID_ID'
    );
  }

  return err;
};

/**
 * Handle JWT errors
 */
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return new AppError(
      'Invalid token. Please log in again.',
      401,
      'INVALID_TOKEN'
    );
  }

  if (err.name === 'TokenExpiredError') {
    return new AppError(
      'Token expired. Please log in again.',
      401,
      'TOKEN_EXPIRED'
    );
  }

  return err;
};

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log error details
  console.error('❌ Error:', {
    message: err.message,
    code: err.errorCode,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id,
    stack: config.isDevelopment ? err.stack : undefined,
  });

  // Handle specific error types
  if (err.name === 'ValidationError' || err.code === 11000 || err.name === 'CastError') {
    error = handleMongooseError(err);
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(err);
  }

  // Handle multer errors (file upload)
  if (err.name === 'MulterError') {
    error = new AppError(
      `File upload error: ${err.message}`,
      400,
      'FILE_UPLOAD_ERROR'
    );
  }

  // Default to 500 if statusCode is not set
  const statusCode = error.statusCode || 500;
  const response = formatErrorResponse(error, req);

  res.status(statusCode).json(response);
};

/**
 * Handle 404 - Route not found
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
