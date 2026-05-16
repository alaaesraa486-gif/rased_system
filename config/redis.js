const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
  socket: {
    // أجبره على استخدام 127.0.0.1 بدلاً من localhost لتجنب خطأ IPv6
    host: '127.0.0.1', 
    port: process.env.REDIS_PORT || 6379,
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Redis connection failed');
      return Math.min(retries * 50, 500);
    }
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('connect', () => {
  console.log('🔴 Connected to Redis');
});

redisClient.on('error', (err) => {
  // هذا السطر سيمنع تراكم رسائل الخطأ في الشاشة إذا لم يكن Redis يعمل
  console.error('❌ Redis Connection Error');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error('⚠️ Could not connect to Redis. Make sure redis-server is running.');
  }
})();

module.exports = redisClient;