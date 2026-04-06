const { createClient } = require('redis');
const { logger } = require('../utils/logger');

let redisClient = null;
let isRedisConnected = false;

/**
 * Initialize Redis client
 */
const initRedis = async () => {
  if (!process.env.REDIS_URL) {
    logger.info('[Redis] REDIS_URL not provided. Local NodeCache will be used.');
    return null;
  }

  try {
    const isTLS = process.env.REDIS_URL.startsWith('rediss://');
    
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: isTLS,
        rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== 'false',
        keepAlive: 5000, // 5 seconds
        noDelay: true,   // Disable Nagle's algorithm for lower latency
        reconnectStrategy: (retries) => {
          // Exponential backoff with a cap of 3 seconds
          const delay = Math.min(retries * 100, 3000);
          if (retries > 5) {
            logger.warn(`[Redis] Connection retry #${retries}. Delaying ${delay}ms...`);
          }
          return delay;
        }
      }
    });

    redisClient.on('error', (err) => {
      // Don't log full stack for common connection errors to keep logs clean
      if (err.code === 'ECONNREFUSED') {
        logger.error('[Redis] Connection refused. Is Redis running?');
      } else {
        logger.error('[Redis] Error:', err.message);
      }
      isRedisConnected = false;
    });

    redisClient.on('connect', () => {
      logger.info('[Redis] Client connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('[Redis] Client connected and ready.');
      isRedisConnected = true;
    });

    redisClient.on('end', () => {
      logger.warn('[Redis] Client connection closed.');
      isRedisConnected = false;
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('[Redis] Setup failed:', error.message);
    isRedisConnected = false;
    return null;
  }
};

/**
 * Get active Redis client
 */
const getRedisClient = () => redisClient;

/**
 * Check if Redis is currently usable
 */
const isRedisReady = () => isRedisConnected && redisClient && redisClient.isOpen;

module.exports = {
  initRedis,
  getRedisClient,
  isRedisReady
};
