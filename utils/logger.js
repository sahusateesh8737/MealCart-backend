const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Device detection helper
const detectDevice = (userAgent) => {
  if (!userAgent) return 'Unknown';
  
  const ua = userAgent.toLowerCase();
  
  // Mobile devices
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) {
    if (ua.includes('iphone')) return 'iPhone';
    if (ua.includes('ipad')) return 'iPad';
    if (ua.includes('android')) return 'Android Mobile';
    return 'Mobile Device';
  }
  
  // Desktop browsers
  if (ua.includes('chrome')) return 'Desktop - Chrome';
  if (ua.includes('firefox')) return 'Desktop - Firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Desktop - Safari';
  if (ua.includes('edge')) return 'Desktop - Edge';
  
  return 'Desktop - Unknown Browser';
};

// Browser detection helper
const detectBrowser = (userAgent) => {
  if (!userAgent) return 'Unknown';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('edg/')) return 'Microsoft Edge';
  if (ua.includes('chrome/') && !ua.includes('edg/')) return 'Google Chrome';
  if (ua.includes('firefox/')) return 'Mozilla Firefox';
  if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
  if (ua.includes('opera/')) return 'Opera';
  
  return 'Unknown Browser';
};

// Get client IP address
const getClientIP = (req) => {
  return req.ip || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         'Unknown';
};

// Format timestamp
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
};

// Log levels
const LOG_LEVELS = {
  ERROR: { level: 0, color: colors.red, label: 'ERROR' },
  WARN: { level: 1, color: colors.yellow, label: 'WARN' },
  INFO: { level: 2, color: colors.green, label: 'INFO' },
  DEBUG: { level: 3, color: colors.blue, label: 'DEBUG' },
  TRACE: { level: 4, color: colors.magenta, label: 'TRACE' }
};

class Logger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.currentLevel = LOG_LEVELS[this.logLevel]?.level ?? 2;
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING === 'true';
    this.logDirectory = path.join(__dirname, '../logs');
    
    // Create logs directory if it doesn't exist
    if (this.enableFileLogging && !fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  _shouldLog(level) {
    return LOG_LEVELS[level].level <= this.currentLevel;
  }

  _formatMessage(level, message, metadata = {}) {
    const timestamp = getTimestamp();
    const logLevel = LOG_LEVELS[level];
    
    // Console format (with colors)
    const consoleMessage = `${colors.dim}[${timestamp}]${colors.reset} ${logLevel.color}${logLevel.label}${colors.reset}: ${message}`;
    
    // File format (without colors)
    const fileMessage = `[${timestamp}] ${logLevel.label}: ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      const metadataStr = JSON.stringify(metadata, null, 2);
      return {
        console: `${consoleMessage}\n${colors.cyan}Metadata:${colors.reset} ${metadataStr}`,
        file: `${fileMessage}\nMetadata: ${metadataStr}`
      };
    }
    
    return {
      console: consoleMessage,
      file: fileMessage
    };
  }

  _writeToFile(message) {
    if (!this.enableFileLogging) return;
    
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDirectory, `app-${today}.log`);
    
    fs.appendFileSync(logFile, message + '\n');
  }

  _log(level, message, metadata = {}) {
    if (!this._shouldLog(level)) return;
    
    const formatted = this._formatMessage(level, message, metadata);
    
    // Console output
    console.log(formatted.console);
    
    // File output
    this._writeToFile(formatted.file);
  }

  error(message, metadata = {}) {
    this._log('ERROR', message, metadata);
  }

  warn(message, metadata = {}) {
    this._log('WARN', message, metadata);
  }

  info(message, metadata = {}) {
    this._log('INFO', message, metadata);
  }

  debug(message, metadata = {}) {
    this._log('DEBUG', message, metadata);
  }

  trace(message, metadata = {}) {
    this._log('TRACE', message, metadata);
  }

  // Special logging methods for common use cases
  logUserActivity(action, req, userId = null, additionalData = {}) {
    const device = detectDevice(req.headers['user-agent']);
    const browser = detectBrowser(req.headers['user-agent']);
    const ip = getClientIP(req);
    
    const metadata = {
      action,
      userId,
      device,
      browser,
      ip,
      userAgent: req.headers['user-agent'],
      method: req.method,
      url: req.originalUrl,
      ...additionalData
    };
    
    this.info(`User Activity: ${action}`, metadata);
  }

  logAPIRequest(req, res, responseTime) {
    const device = detectDevice(req.headers['user-agent']);
    const ip = getClientIP(req);
    
    const metadata = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      device,
      ip,
      userAgent: req.headers['user-agent']
    };
    
    const level = res.statusCode >= 400 ? 'WARN' : 'INFO';
    this._log(level, `API Request: ${req.method} ${req.originalUrl}`, metadata);
  }

  logRecipeGeneration(req, userId, recipeData, processingTime) {
    const device = detectDevice(req.headers['user-agent']);
    const ip = getClientIP(req);
    
    const metadata = {
      userId,
      device,
      ip,
      processingTime: `${processingTime}ms`,
      recipeTitle: recipeData.title || recipeData.name,
      ingredients: recipeData.ingredients?.length || 0,
      cookingTime: recipeData.cookingTime,
      difficulty: recipeData.difficulty,
      dietaryTags: recipeData.dietaryTags
    };
    
    this.info('Recipe Generated', metadata);
  }

  logError(error, req = null, additionalContext = {}) {
    const metadata = {
      error: error.message,
      stack: error.stack,
      ...additionalContext
    };
    
    if (req) {
      metadata.method = req.method;
      metadata.url = req.originalUrl;
      metadata.device = detectDevice(req.headers['user-agent']);
      metadata.ip = getClientIP(req);
    }
    
    this.error(`Application Error: ${error.message}`, metadata);
  }

  logDatabaseOperation(operation, collection, success, duration, additionalData = {}) {
    const metadata = {
      operation,
      collection,
      success,
      duration: `${duration}ms`,
      ...additionalData
    };
    
    const level = success ? 'DEBUG' : 'ERROR';
    this._log(level, `Database ${operation} on ${collection}`, metadata);
  }

  logSystemEvent(event, details = {}) {
    this.info(`System Event: ${event}`, details);
  }
}

// Create and export singleton instance
const logger = new Logger();

module.exports = {
  logger,
  detectDevice,
  detectBrowser,
  getClientIP
};
