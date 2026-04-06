const createApp = require('./app');
const config = require('./config');
const database = require('./config/database');
const { initRedis, getRedisClient } = require('./config/redis');

async function startServer() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await database.connect();

    console.log('⚡ Initializing Redis Cache...');
    await initRedis();

    const app = createApp();
    const PORT = config.server.port;
    const HOST = config.server.host;

    const server = app.listen(PORT, HOST, () => {
      console.log('');
      console.log('✅ MealCart Backend Started');
      console.log(`🌐 Server: http://${HOST}:${PORT}`);
      console.log(`🏥 Health: http://${HOST}:${PORT}/health`);
      console.log('');
    });

    const gracefulShutdown = async (signal) => {
      console.log(`⚠️  ${signal} - Shutting down...`);
      const client = getRedisClient();
      if (client && client.isOpen) {
        await client.quit();
        console.log('💤 Redis connection closed.');
      }
      server.close(async () => {
        await database.disconnect();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = startServer;
