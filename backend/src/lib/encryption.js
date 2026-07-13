const crypto = require("crypto");

/**
 * Algoritmo de criptografia: AES-256-CBC
 * - 256 bits de chave
 * - Cipher Block Chaining
 * - IV aleatório por criptografia (mitiga padrões)
 */

/**
 * Gera chave de criptografia a partir de JWT_SECRET
 * Garante que a chave seja de tamanho exato (32 bytes = 256 bits)
 */
function getEncryptionKey() {
  const secret = process.env.JWT_SECRET || "fallback-secret-key";
  // Pega os primeiros 32 bytes (256 bits) usando SHA-256
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Criptografa um texto plano
 * @param {string} plaintext - Texto a criptografar
 * @returns {string} IV:Encrypted (em hexadecimal)
 */
function encrypt(plaintext) {
  if (!plaintext) return null;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16); // IV aleatório de 16 bytes

  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Retorna: IV (em hex) + ":" + dados criptografados (em hex)
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Descriptografa um texto criptografado
 * @param {string} encryptedData - String no formato "IV:Encrypted"
 * @returns {string|null} Texto descriptografado ou null se inválido
 */
function decrypt(encryptedData) {
  if (!encryptedData) return null;

  try {
    const [ivHex, encryptedHex] = encryptedData.split(":");

    if (!ivHex || !encryptedHex) {
      throw new Error("Formato de criptografia inválido");
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    console.error("Erro ao descriptografar dados:", err.message);
    return null;
  }
}

module.exports = {
  encrypt,
  decrypt,
};
