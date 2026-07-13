const speakeasy = require('speakeasy');
const crypto = require('crypto');

/**
 * Gera um novo secret TOTP para um usuário
 * @param {string} email - Email do usuário
 * @returns {Object} { secret, qrCode }
 */
function generateTotpSecret(email) {
  const secret = speakeasy.generateSecret({
    name: `E Tenho Ditto Pizzaria (${email})`,
    issuer: 'E Tenho Ditto Pizzaria',
    length: 32, // 256 bits
  });

  return {
    secret: secret.base32, // Para guardar no DB e usar em apps
    dataUrl: secret.otpauth_url, // URL para gerar QR Code
  };
}

/**
 * Verifica se um código TOTP é válido
 * @param {string} totpSecret - Secret em base32 armazenado no DB
 * @param {string} token - Código de 6 dígitos fornecido pelo usuário
 * @returns {boolean}
 */
function verifyTotp(totpSecret, token) {
  const window = parseInt(process.env.TOTP_WINDOW || 2);

  return speakeasy.totp.verify({
    secret: totpSecret,
    encoding: 'base32',
    token: String(token),
    window, // Tolerância de ±60 segundos (2 steps)
  });
}

/**
 * Gera um conjunto de backup codes (10 códigos de 8 caracteres)
 * Retorna os códigos em array e versão criptografada para guardar no DB
 * @returns {Object} { codes: [], encrypted: '' }
 */
function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }

  // Criptografa para armazenar no DB
  const encrypted = encryptBackupCodes(codes);

  return {
    codes, // Para mostrar ao usuário uma única vez
    encrypted,
  };
}

/**
 * Criptografa backup codes para armazenar no BD
 * @param {Array} codes - Array de codes
 * @returns {string} JSON criptografado
 */
function encryptBackupCodes(codes) {
  const key = Buffer.from(process.env.JWT_SECRET || 'fallback-key').slice(0, 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(codes), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Retorna: IV + ENCRYPTED
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografa backup codes
 * @param {string} encrypted - String criptografada do DB
 * @returns {Array} Array de codes
 */
function decryptBackupCodes(encrypted) {
  const key = Buffer.from(process.env.JWT_SECRET || 'fallback-key').slice(0, 32);
  const [ivHex, encryptedHex] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

/**
 * Verifica e usa um backup code
 * Retorna true se válido e remove o código da lista
 * @param {string} encrypted - String criptografada do DB
 * @param {string} code - Código fornecido pelo usuário
 * @returns {Object} { valid: boolean, remaining: int, encrypted: string }
 */
function useBackupCode(encrypted, code) {
  const codes = decryptBackupCodes(encrypted);
  const index = codes.indexOf(String(code).toUpperCase());

  if (index === -1) {
    return {
      valid: false,
      remaining: codes.length,
      encrypted,
    };
  }

  // Remove o código usado
  codes.splice(index, 1);
  const newEncrypted = encryptBackupCodes(codes);

  return {
    valid: true,
    remaining: codes.length,
    encrypted: newEncrypted,
  };
}

module.exports = {
  generateTotpSecret,
  verifyTotp,
  generateBackupCodes,
  encryptBackupCodes,
  decryptBackupCodes,
  useBackupCode,
};
