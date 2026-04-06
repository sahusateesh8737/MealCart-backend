const NodeCache = require('node-cache');
const { logger } = require('./logger');

// Set default TTL to 1 hour (3600 seconds)
const cache = new NodeCache({ 
  stdTTL: 3600, 
  checkperiod: 120,
  useClones: false // Better for performance if data is not mutated
});

/**
 * Caching utility with helper methods
 */
const cacheUtil = {
  /**
   * Get item from cache
   */
  get: (key) => {
    const value = cache.get(key);
    if (value !== undefined) {
      // logger.debug(`[Cache Hit] Key: ${key}`);
      return value;
    }
    return null;
  },

  /**
   * Set item in cache
   */
  set: (key, value, ttl) => {
    return cache.set(key, value, ttl);
  },

  /**
   * Delete item from cache
   */
  del: (key) => {
    return cache.del(key);
  },

  /**
   * Delete items by pattern (regex-like)
   */
  delPattern: (pattern) => {
    const keys = cache.keys();
    const regex = new RegExp(pattern);
    const keysToDelete = keys.filter(k => regex.test(k));
    if (keysToDelete.length > 0) {
      cache.del(keysToDelete);
      logger.info(`[Cache] Invalidated ${keysToDelete.length} keys matching pattern: ${pattern}`);
    }
  },

  /**
   * Clear all cache
   */
  flush: () => {
    return cache.flushAll();
  },

  /**
   * Get or Fetch pattern: Try to get from cache, otherwise fetch and cache
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data
   * @param {number} ttl - Optional TTL in seconds
   */
  getOrFetch: async (key, fetchFn, ttl) => {
    const cachedData = cache.get(key);
    if (cachedData !== undefined) {
      return cachedData;
    }

    try {
      const freshData = await fetchFn();
      if (freshData !== undefined && freshData !== null) {
        cache.set(key, freshData, ttl);
      }
      return freshData;
    } catch (error) {
      logger.error(`[Cache Error] Failed to fetch for key ${key}:`, error);
      throw error;
    }
  },

  /**
   * Middleware to cache responses for specific routes
   */
  middleware: (ttl) => {
    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const key = `__express__${req.originalUrl || req.url}__uID:${req.user?._id || 'guest'}`;
      const cachedResponse = cache.get(key);

      if (cachedResponse) {
        return res.json(cachedResponse);
      } else {
        res.originalJson = res.json;
        res.json = (body) => {
          // Only cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            cache.set(key, body, ttl);
          }
          res.originalJson(body);
        };
        next();
      }
    };
  }
};

module.exports = cacheUtil;
