const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const OFFCHAIN_DIR = path.resolve(__dirname, '..', '..', 'offchain_storage');

// Ensure off-chain directory exists
if (!fs.existsSync(OFFCHAIN_DIR)) {
  fs.mkdirSync(OFFCHAIN_DIR, { recursive: true });
}

// Base58 character set used by IPFS (Bitcoin alphabet)
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Base58 encode a Buffer
 */
function base58Encode(buffer) {
  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    for (let j = 0; j < digits.length; j++) {
      digits[j] <<= 8;
    }
    digits[0] += buffer[i];
    let carry = 0;
    for (let j = 0; j < digits.length; ++j) {
      digits[j] += carry;
      carry = (digits[j] / 58) | 0;
      digits[j] %= 58;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  for (let i = 0; i < buffer.length && buffer[i] === 0; i++) {
    digits.push(0);
  }
  return digits
    .reverse()
    .map((digit) => ALPHABET[digit])
    .join('');
}

/**
 * Compute standard IPFS CIDv0 for a data payload
 * Multi-hash: 0x12 (sha2-256), 0x20 (32 bytes length) + 32-byte SHA-256 digest -> Base58
 */
function computeIpfsCid(contentBuffer) {
  const sha256Digest = crypto.createHash('sha256').update(contentBuffer).digest();
  const multihashHeader = Buffer.from([0x12, 0x20]);
  const multihash = Buffer.concat([multihashHeader, sha256Digest]);
  return base58Encode(multihash);
}

/**
 * Upload arbitrary data or large sensor telemetry to off-chain IPFS storage
 * @param {string|object|Buffer} data - Data to store off-chain
 * @param {object} [metadata] - Optional metadata (batchId, uploader, timestamp)
 * @returns {object} { cid, size, sha256, storagePath, timestamp }
 */
function uploadToOffchain(data, metadata = {}) {
  const serialized = typeof data === 'object' && !Buffer.isBuffer(data) ? JSON.stringify(data, null, 2) : data;
  const contentBuffer = Buffer.isBuffer(serialized) ? serialized : Buffer.from(serialized, 'utf8');

  const cid = computeIpfsCid(contentBuffer);
  const sha256 = crypto.createHash('sha256').update(contentBuffer).digest('hex');

  const record = {
    cid,
    sha256,
    sizeBytes: contentBuffer.length,
    metadata,
    storedAt: new Date().toISOString(),
    content: serialized.toString(),
  };

  const filePath = path.join(OFFCHAIN_DIR, `${cid}.json`);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');

  return {
    cid,
    sha256,
    sizeBytes: contentBuffer.length,
    storagePath: filePath,
    timestamp: record.storedAt,
  };
}

/**
 * Retrieve content from off-chain IPFS storage and verify its integrity
 * @param {string} cid - The IPFS CID
 * @returns {object} { cid, content, metadata, verified, sizeBytes }
 */
function retrieveFromOffchain(cid) {
  const filePath = path.join(OFFCHAIN_DIR, `${cid}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Off-chain content not found for CID: ${cid}`);
  }

  const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const contentBuffer = Buffer.from(fileData.content, 'utf8');

  // Verify cryptographic integrity: re-compute CID to detect tampering
  const currentCid = computeIpfsCid(contentBuffer);
  const isIntact = currentCid === cid;

  return {
    cid,
    content: fileData.content,
    metadata: fileData.metadata,
    verified: isIntact,
    sizeBytes: fileData.sizeBytes,
    storedAt: fileData.storedAt,
  };
}

/**
 * Verify whether given data matches an expected IPFS CID
 */
function verifyDataMatchesCid(data, expectedCid) {
  const serialized = typeof data === 'object' && !Buffer.isBuffer(data) ? JSON.stringify(data, null, 2) : data;
  const contentBuffer = Buffer.isBuffer(serialized) ? serialized : Buffer.from(serialized, 'utf8');
  const computedCid = computeIpfsCid(contentBuffer);
  return computedCid === expectedCid;
}

module.exports = {
  uploadToOffchain,
  retrieveFromOffchain,
  verifyDataMatchesCid,
  computeIpfsCid,
  OFFCHAIN_DIR,
};
