const { encrypt, decrypt, generateKey } = require('../security/aesEncryption');
const { uploadToOffchain, retrieveFromOffchain, verifyDataMatchesCid } = require('../security/ipfsStorage');
const { getContract } = require('../fabricGateway');

/**
 * Encrypt sensitive payload using AES-256-GCM
 * POST /api/security/encrypt
 */
async function encryptPayload(req, res) {
  try {
    const { data, secretKey } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing data field to encrypt' });
    }

    const encrypted = encrypt(data, secretKey);
    return res.status(200).json({
      success: true,
      message: 'Data successfully encrypted with AES-256-GCM',
      data: encrypted,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Decrypt AES-256-GCM payload
 * POST /api/security/decrypt
 */
async function decryptPayload(req, res) {
  try {
    const { encryptedPayload, secretKey } = req.body;
    if (!encryptedPayload) {
      return res.status(400).json({ error: 'Missing encryptedPayload' });
    }

    const decrypted = decrypt(encryptedPayload, secretKey);
    return res.status(200).json({
      success: true,
      message: 'Data successfully decrypted and authenticated',
      data: decrypted,
    });
  } catch (error) {
    return res.status(400).json({ error: `Decryption failed or auth tag invalid (tampering detected): ${error.message}` });
  }
}

/**
 * Store bulk telemetry or document off-chain in IPFS and optionally anchor CID on Fabric
 * POST /api/security/offchain/upload
 */
async function storeOffchain(req, res) {
  try {
    const { batchId, telemetryData, metadata, anchorToBlockchain } = req.body;

    if (!telemetryData) {
      return res.status(400).json({ error: 'Missing telemetryData field' });
    }

    // 1. Store in Off-Chain IPFS engine
    const offchainResult = uploadToOffchain(telemetryData, {
      batchId: batchId || 'UNASSIGNED',
      uploadedBy: req.body.uploader || 'ColdChainRx_Gateway',
      ...metadata,
    });

    let blockchainAnchored = false;

    // 2. If anchorToBlockchain is requested and batchId is provided, anchor the IPFS CID to Fabric
    if (anchorToBlockchain && batchId) {
      let gateway, client;
      try {
        const conn = await getContract();
        gateway = conn.gateway;
        client = conn.client;

        // Ensure batch exists
        try {
          await conn.contract.evaluateTransaction('QueryBatch', batchId);
        } catch (e) {
          await conn.contract.submitTransaction('CreateBatch', batchId, 'ColdChain Secured Batch', 'PharmaManufacturer');
        }

        // Anchor the IPFS CID as a temperature log entry with reporter "IPFS_ANCHOR"
        const anchorTimestamp = new Date().toISOString();
        const reporterTag = `IPFS_CID:${offchainResult.cid}`;
        await conn.contract.submitTransaction('LogTemperature', batchId, anchorTimestamp, "0.0", reporterTag);
        blockchainAnchored = true;
      } catch (fabricErr) {
        console.warn('[OffChain Controller] Could not anchor to Fabric:', fabricErr.message);
      } finally {
        if (gateway) gateway.close();
        if (client) client.close();
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Data stored in off-chain IPFS storage successfully',
      data: {
        cid: offchainResult.cid,
        sha256: offchainResult.sha256,
        sizeBytes: offchainResult.sizeBytes,
        blockchainAnchored,
        timestamp: offchainResult.timestamp,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Retrieve off-chain IPFS content by CID with integrity verification
 * GET /api/security/offchain/:cid
 */
async function retrieveOffchain(req, res) {
  try {
    const { cid } = req.params;
    const result = retrieveFromOffchain(cid);

    let parsedContent;
    try {
      parsedContent = JSON.parse(result.content);
    } catch (e) {
      parsedContent = result.content;
    }

    return res.status(200).json({
      success: true,
      verified: result.verified,
      cid: result.cid,
      metadata: result.metadata,
      sizeBytes: result.sizeBytes,
      storedAt: result.storedAt,
      data: parsedContent,
    });
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
}

/**
 * Verify whether an arbitrary payload matches a known IPFS CID
 * POST /api/security/offchain/verify
 */
async function verifyTamperProof(req, res) {
  try {
    const { data, expectedCid } = req.body;
    if (!data || !expectedCid) {
      return res.status(400).json({ error: 'Missing data or expectedCid' });
    }

    const matches = verifyDataMatchesCid(data, expectedCid);
    return res.status(200).json({
      success: true,
      matches,
      tampered: !matches,
      message: matches
        ? 'Data matches expected IPFS CID. Integrity confirmed.'
        : 'ALERT: Data hash mismatch! Content has been modified/tampered with.',
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  encryptPayload,
  decryptPayload,
  storeOffchain,
  retrieveOffchain,
  verifyTamperProof,
};
