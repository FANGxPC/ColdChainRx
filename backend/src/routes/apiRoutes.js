const express = require('express');
const router = express.Router();
const {
  createBatch,
  logTemperature,
  transferCustody,
  queryBatch,
  getBatchHistory,
} = require('../controllers/batchController');
const {
  encryptPayload,
  decryptPayload,
  storeOffchain,
  retrieveOffchain,
  verifyTamperProof,
} = require('../controllers/securityController');

// Batch Management Routes
router.post('/batch/create', createBatch);
router.post('/batch/transfer', transferCustody);
router.get('/batch/:id', queryBatch);
router.get('/batch/:id/history', getBatchHistory);

// IoT Sensor Route (For Omkar's ESP32 + DHT11/DHT22 Hardware)
router.post('/iot/temperature', logTemperature);

// Security & Off-Chain IPFS Routes (Week 7 Deliverables)
router.post('/security/encrypt', encryptPayload);
router.post('/security/decrypt', decryptPayload);
router.post('/security/offchain/upload', storeOffchain);
router.get('/security/offchain/:cid', retrieveOffchain);
router.post('/security/offchain/verify', verifyTamperProof);

module.exports = router;

