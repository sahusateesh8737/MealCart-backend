/**
 * Database Configuration and Connection Management
 * Handles MongoDB connection with retry logic and graceful shutdown
 */

const mongoose = require('mongoose');
const config = require('./index');

class Database {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  /**
   * Connect to MongoDB with retry logic
   */
  async connect() {
    if (this.isConnected) {
      console.log('📦 MongoDB: Already connected');
      return;
    }

    const options = {
      ...config.database.options,
      // Additional production-ready options
      autoIndex: !config.isProduction, // Don't build indexes in production
      retryWrites: true,
      w: 'majority',
    };

    try {
      await mongoose.connect(config.database.uri, options);
      
      this.isConnected = true;
      this.retryCount = 0;
      
      console.log('✅ MongoDB: Connected successfully');
      
      if (config.database.debug) {
        mongoose.set('debug', true);
      }

      // Setup connection event handlers
      this.setupEventHandlers();
      
    } catch (error) {
      console.error('❌ MongoDB: Connection failed', {
        error: error.message,
        retryCount: this.retryCount,
        maxRetries: this.maxRetries,
      });

      this.retryCount++;

      if (this.retryCount < this.maxRetries) {
        console.log(`🔄 MongoDB: Retrying connection in ${this.retryDelay / 1000}s... (Attempt ${this.retryCount + 1}/${this.maxRetries})`);
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      } else {
        console.error('❌ MongoDB: Max retries reached. Exiting...');
        if (!config.isProduction && !config.isServerless) {
          process.exit(1);
        }
        throw error;
      }
    }
  }

  /**
   * Setup mongoose connection event handlers
   */
  setupEventHandlers() {
    mongoose.connection.on('connected', () => {
      console.log('📦 MongoDB: Connection established');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB: Connection error', err);
      this.isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('📦 MongoDB: Disconnected');
      this.isConnected = false;
      
      // Auto-reconnect in production
      if (config.isProduction || config.isServerless) {
        console.log('🔄 MongoDB: Attempting to reconnect...');
        setTimeout(() => this.connect(), this.retryDelay);
      }
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB: Reconnected successfully');
      this.isConnected = true;
    });

    // Handle process termination
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Gracefully disconnect from MongoDB
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('✅ MongoDB: Disconnected gracefully');
    } catch (error) {
      console.error('❌ MongoDB: Error during disconnection', error);
      throw error;
    }
  }

  /**
   * Check database connection health
   */
  async healthCheck() {
    if (!this.isConnected) {
      return {
        status: 'disconnected',
        message: 'Database is not connected',
      };
    }

    try {
      const state = mongoose.connection.readyState;
      const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
      };

      return {
        status: states[state] || 'unknown',
        message: `Database is ${states[state] || 'unknown'}`,
        details: {
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          models: Object.keys(mongoose.connection.models),
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Health check failed',
        error: error.message,
      };
    }
  }
}

// Export singleton instance
module.exports = new Database();
