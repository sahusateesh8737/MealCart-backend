// Serverless-optimized logger for Vercel deployment

// Color codes for console output (simplified for serverless)
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

// Simple device detection
const detectDevice = (userAgent) => {
  if (!userAgent) return 'Unknown';
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'Mobile';
  }
  return 'Desktop';
};

// Simple browser detection
const detectBrowser = (userAgent) => {
  if (!userAgent) return 'Unknown Browser';
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('edge')) return 'Edge';
  return 'Other Browser';
};

class ServerlessLogger {
  constructor() {
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
    this.isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  }

  formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const colorMap = {
      'ERROR': colors.red,
      'WARN': colors.yellow,
      'INFO': colors.green,
      'DEBUG': colors.blue,
      'TRACE': colors.magenta
    };
    
    const color = colorMap[level] || colors.reset;
    const metadataStr = Object.keys(metadata).length > 0 ? `\nMetadata: ${JSON.stringify(metadata, null, 2)}` : '';
    
    if (this.isServerless) {
      // Simple format for serverless (no colors in production logs)
      return `[${timestamp}] ${level}: ${message}${metadataStr}`;
    } else {
      // Colored format for local development
      return `${color}[${timestamp}] ${level}: ${message}${colors.reset}${metadataStr}`;
    }
  }

  shouldLog(level) {
    const levels = { 'ERROR': 0, 'WARN': 1, 'INFO': 2, 'DEBUG': 3, 'TRACE': 4 };
    return levels[level] <= levels[this.logLevel];
  }

  error(message, metadata = {}) {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', message, metadata));
    }
  }

  warn(message, metadata = {}) {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', message, metadata));
    }
  }

  info(message, metadata = {}) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', message, metadata));
    }
  }

  debug(message, metadata = {}) {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', message, metadata));
    }
  }

  trace(message, metadata = {}) {
    if (this.shouldLog('TRACE')) {
      console.log(this.formatMessage('TRACE', message, metadata));
    }
  }

  // Serverless-optimized user activity logging
  logUserActivity(action, metadata = {}) {
    this.info(`User Activity: ${action}`, metadata);
  }

  // Serverless-optimized recipe generation logging
  logRecipeGeneration(query, metadata = {}) {
    this.info(`Recipe Generation: ${query}`, metadata);
  }

  // Error logging helper
  logError(error, context = {}) {
    this.error(`Application Error: ${error.message}`, {
      ...context,
      stack: error.stack,
      name: error.name
    });
  }
}

// Create singleton instance
const logger = new ServerlessLogger();

module.exports = {
  logger,
  detectDevice,
  detectBrowser
};
