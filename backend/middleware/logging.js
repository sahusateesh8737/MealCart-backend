const { logger } = require('../utils/logger');

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log the incoming request
  logger.debug(`Incoming Request: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    headers: req.headers,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query
  });

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    logger.logAPIRequest(req, res, responseTime);
    originalEnd.apply(this, args);
  };

  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  logger.logError(err, req, {
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  next(err);
};

module.exports = {
  requestLogger,
  errorLogger
};
