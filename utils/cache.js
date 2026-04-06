const NodeCache = require('node-cache');
const { logger } = require('./logger');
const { getRedisClient, isRedisReady } = require('../config/redis');

// Local fallback cache
const localCache = new NodeCache({ 
  stdTTL: 3600, 
  checkperiod: 120,
  useClones: false 
});

/**
 * Caching utility with helper methods
 * Supports Redis (primary) and NodeCache (fallback)
 */
const cacheUtil = {
  /**
   * Get item from cache
   */
  get: async (key) => {
    try {
      if (isRedisReady()) {
        const value = await getRedisClient().get(key);
        return value ? JSON.parse(value) : null;
      }
    } catch (error) {
      logger.warn(`[Cache] Redis get failed for ${key}, falling back to local.`);
    }
    
    const value = localCache.get(key);
    return value !== undefined ? value : null;
  },

  /**
   * Set item in cache
   */
  set: async (key, value, ttl) => {
    try {
      if (isRedisReady()) {
        const stringValue = JSON.stringify(value);
        if (ttl) {
          await getRedisClient().setEx(key, parseInt(ttl), stringValue);
        } else {
          await getRedisClient().set(key, stringValue);
        }
      }
    } catch (error) {
      logger.warn(`[Cache] Redis set failed for ${key}, using local.`);
    }
    
    return localCache.set(key, value, ttl);
  },

  /**
   * Delete item from cache
   */
  del: async (key) => {
    try {
      if (isRedisReady()) {
        await getRedisClient().del(key);
      }
    } catch (error) {
      logger.warn(`[Cache] Redis del failed for ${key}, using local.`);
    }
    
    return localCache.del(key);
  },

  /**
   * Delete items by pattern
   */
  delPattern: async (pattern) => {
    try {
      if (isRedisReady()) {
        const client = getRedisClient();
        const keys = await client.keys(pattern.replace(/\.\*/g, '*'));
        if (keys.length > 0) {
          await client.del(keys);
        }
      }
    } catch (error) {
      logger.warn(`[Cache] Redis delPattern failed for ${pattern}, using local.`);
    }

    const keys = localCache.keys();
    const regex = new RegExp(pattern);
    const keysToDelete = keys.filter(k => regex.test(k));
    if (keysToDelete.length > 0) {
      localCache.del(keysToDelete);
    }
  },

  /**
   * Clear all cache
   */
  flush: async () => {
    try {
      if (isRedisReady()) {
        await getRedisClient().flushDb();
      }
    } catch (error) {
      logger.warn('[Cache] Redis flush failed, using local.');
    }
    
    return localCache.flushAll();
  },

  /**
   * Get or Fetch pattern: Try to get from cache, otherwise fetch and cache
   */
  getOrFetch: async (key, fetchFn, ttl) => {
    const cachedData = await cacheUtil.get(key);
    if (cachedData !== null) {
      return cachedData;
    }

    try {
      const freshData = await fetchFn();
      if (freshData !== undefined && freshData !== null) {
        await cacheUtil.set(key, freshData, ttl);
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
    return async (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const key = `__express__${req.originalUrl || req.url}__uID:${req.user?._id || 'guest'}`;
      
      try {
        const cachedResponse = await cacheUtil.get(key);
        if (cachedResponse) {
          return res.json(cachedResponse);
        }
      } catch (error) {
        logger.warn('[Cache] Middleware get failed, proceeding without cache.');
      }

      res.originalJson = res.json;
      res.json = async (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          await cacheUtil.set(key, body, ttl);
        }
        res.originalJson(body);
      };
      next();
    };
  }
};

module.exports = cacheUtil;
