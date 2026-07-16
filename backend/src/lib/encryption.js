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

/**
 * Normaliza um número de telefone para busca/hash.
 * Remove prefixo SIP, espaços, traços, parênteses e o DDI 55 do Brasil.
 * Mantém apenas dígitos (DDD + número). Ex.: "sip:+55 (54) 99999-1234" -> "54999991234".
 * @param {string} phone
 * @returns {string} apenas dígitos, sem DDI 55
 */
function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, ""); // só dígitos
  // Remove DDI 55 quando o número tem tamanho de telefone nacional + DDI (12 ou 13 dígitos)
  if (digits.length > 11 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Hash determinístico do telefone (HMAC-SHA256), pesquisável no banco.
 * Diferente de encrypt(): sem IV, mesma entrada => mesma saída, permitindo busca de cliente.
 * @param {string} phone - telefone (será normalizado antes)
 * @returns {string} hash hex, ou "" se telefone vazio
 */
function hashPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  const secret = process.env.PHONE_HASH_SECRET || process.env.JWT_SECRET || "fallback-secret-key";
  return crypto.createHmac("sha256", secret).update(normalized).digest("hex");
}

module.exports = {
  encrypt,
  decrypt,
  normalizePhone,
  hashPhone,
};
