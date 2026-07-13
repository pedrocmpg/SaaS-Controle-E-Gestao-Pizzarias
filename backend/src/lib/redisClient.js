const redis = require('redis');

let client;

/**
 * Inicializa conexão com Redis
 * Em desenvolvimento, usa localhost:6379
 * Em produção, usa REDIS_URL do .env
 */
async function initRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  client = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        const delay = Math.min(retries * 50, 500);
        return delay;
      },
    },
  });

  client.on('error', (err) => {
    console.error('❌ Redis Error:', err);
  });

  client.on('connect', () => {
    console.log('✅ Conectado ao Redis');
  });

  await client.connect();
  return client;
}

/**
 * Retorna cliente Redis (já inicializado)
 */
function getRedisClient() {
  if (!client) {
    throw new Error('Redis não foi inicializado. Chame initRedis() primeiro.');
  }
  return client;
}

/**
 * Desconecta Redis (para graceful shutdown)
 */
async function disconnectRedis() {
  if (client) {
    await client.quit();
    console.log('✅ Redis desconectado');
  }
}

module.exports = {
  initRedis,
  getRedisClient,
  disconnectRedis,
};
