/**
 * Blacklist de tokens JWT revogados
 * Usa Redis para persistência entre reinicializações
 * Fallback para Set em memória se Redis não estiver disponível
 */

const { getRedisClient } = require('./redisClient');

let fallbackBlacklist = new Set(); // Fallback se Redis não estiver disponível

/**
 * Verifica se Redis está disponível
 */
function isRedisAvailable() {
  try {
    const client = getRedisClient();
    return client && client.isOpen;
  } catch (err) {
    return false;
  }
}

/**
 * Adiciona token à blacklist
 * @param {string} token - JWT token
 * @param {Date} expiresAt - Data de expiração do token
 */
async function addToBlacklist(token, expiresAt) {
  try {
    if (isRedisAvailable()) {
      const client = getRedisClient();
      const ttl = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000) : 28800; // 8h padrão

      if (ttl > 0) {
        await client.setEx(`blacklist:${token}`, ttl, '1');
        console.log(`🚫 Token adicionado à blacklist (Redis, TTL: ${ttl}s)`);
      }
    } else {
      // Fallback: em-memória
      fallbackBlacklist.add(token);
      console.log('⚠️ Redis indisponível. Token na blacklist em-memória (pode ser perdido ao restart)');
    }
  } catch (err) {
    console.error('❌ Erro ao adicionar token à blacklist:', err.message);
    // Fallback mesmo em erro
    fallbackBlacklist.add(token);
  }
}

/**
 * Verifica se token está na blacklist
 * @param {string} token - JWT token
 * @returns {Promise<boolean>}
 */
async function isBlacklisted(token) {
  try {
    if (isRedisAvailable()) {
      const client = getRedisClient();
      const exists = await client.exists(`blacklist:${token}`);
      return exists === 1;
    } else {
      // Fallback: em-memória
      return fallbackBlacklist.has(token);
    }
  } catch (err) {
    console.error('❌ Erro ao verificar blacklist:', err.message);
    // Fallback em erro (mais seguro negar acesso)
    return fallbackBlacklist.has(token);
  }
}

/**
 * Limpa a blacklist (para testes/reset)
 * ⚠️ Use com cuidado em produção
 */
async function clearBlacklist() {
  try {
    if (isRedisAvailable()) {
      const client = getRedisClient();
      const keys = await client.keys('blacklist:*');
      if (keys.length > 0) {
        await client.del(keys);
        console.log(`✅ ${keys.length} tokens removidos da blacklist (Redis)`);
      }
    }
    fallbackBlacklist.clear();
    console.log('✅ Blacklist limpa');
  } catch (err) {
    console.error('❌ Erro ao limpar blacklist:', err.message);
  }
}

module.exports = {
  addToBlacklist,
  isBlacklisted,
  clearBlacklist,
};
