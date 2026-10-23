const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits auth tag

// Default 256-bit master key if not provided in environment
const DEFAULT_KEY_HEX = process.env.ENCRYPTION_MASTER_KEY || crypto.createHash('sha256').update('ColdChainRx_Secure_Master_Key_2026').digest('hex');

/**
 * Encrypt arbitrary text or object using AES-256-GCM
 * @param {string|object} data - Data to encrypt
 * @param {string} [customKeyHex] - Optional 32-byte (64 hex char) key
 * @returns {object} { ciphertext, iv, authTag, algorithm }
 */
function encrypt(data, customKeyHex = null) {
  const key = Buffer.from(customKeyHex || DEFAULT_KEY_HEX, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plainText = typeof data === 'object' ? JSON.stringify(data) : String(data);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    algorithm: ALGORITHM,
    iv: iv.toString('hex'),
    authTag: authTag,
    ciphertext: encrypted,
  };
}

/**
 * Decrypt an AES-256-GCM payload
 * @param {object} payload - { ciphertext, iv, authTag }
 * @param {string} [customKeyHex] - Optional 32-byte key in hex
 * @returns {string|object} Decrypted data
 */
function decrypt(payload, customKeyHex = null) {
  const { ciphertext, iv, authTag } = payload;
  if (!ciphertext || !iv || !authTag) {
    throw new Error('Invalid encrypted payload: ciphertext, iv, and authTag are required.');
  }

  const key = Buffer.from(customKeyHex || DEFAULT_KEY_HEX, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch (e) {
    return decrypted;
  }
}

/**
 * Generate a new random 256-bit key in hex
 */
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  encrypt,
  decrypt,
  generateKey,
  ALGORITHM,
};
