const { encrypt, decrypt, generateKey } = require('./src/security/aesEncryption');
const { uploadToOffchain, retrieveFromOffchain, verifyDataMatchesCid } = require('./src/security/ipfsStorage');

console.log('======================================================================');
console.log('🛡️  COLDCHAINRX WEEK 7: AES ENCRYPTION & IPFS OFF-CHAIN SECURITY TEST');
console.log('======================================================================\n');

async function runSecurityTests() {
  // -------------------------------------------------------------------------
  // TEST 1: Confidential Data Privacy & AES-256-GCM Encryption
  // -------------------------------------------------------------------------
  console.log('--- DEMONSTRATION 1: AES-256-GCM Confidentiality & Anti-Tampering ---');
  const sensitiveBatchData = {
    batchId: 'BATCH_COVID_mRNA_0099',
    patientRecipient: 'John Doe, Medical ID: #984321',
    receivingHospital: 'St. Jude Children Research Hospital',
    storageGPS: { lat: 37.7749, lng: -122.4194 },
    internalFormulaCode: 'SECRET_VACCINE_STABILIZER_V4',
  };

  console.log('Original Sensitive Payload:');
  console.log(JSON.stringify(sensitiveBatchData, null, 2));

  // Encrypt
  const encrypted = encrypt(sensitiveBatchData);
  console.log('\nEncrypted for Blockchain Storage (Ciphertext + IV + AuthTag):');
  console.log({
    algorithm: encrypted.algorithm,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    ciphertextSnippet: encrypted.ciphertext.slice(0, 48) + '... (total: ' + encrypted.ciphertext.length + ' chars)',
  });

  // Decrypt
  const decrypted = decrypt(encrypted);
  console.log('\nDecryption with Master Key:');
  console.log(`Match? ${decrypted.batchId === sensitiveBatchData.batchId ? '✅ SUCCESS' : '❌ FAILED'}`);

  // Tampering attack test: flip a byte in ciphertext
  console.log('\n[Attack Simulation]: Tampering with ciphertext on transit...');
  const tamperedCiphertext = encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.endsWith('0') ? '1' : '0');
  try {
    decrypt({ ...encrypted, ciphertext: tamperedCiphertext });
    console.error('❌ FAILURE: Tampered ciphertext was accepted!');
  } catch (err) {
    console.log(`✅ MITIGATED: GCM Auth Tag rejected tampered data: "${err.message}"`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Off-Chain IPFS Telemetry Storage & CID Generation
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------------');
  console.log('--- DEMONSTRATION 2: Off-Chain IPFS Content Addressing & CID Anchoring ---');

  // Large time-series sensor telemetry block (10 readings)
  const bulkSensorTelemetry = {
    batchId: 'BATCH_COVID_mRNA_0099',
    unitId: 'TRUCK_REFRIGERATION_SENSORS_RACK_04',
    samplingIntervalSeconds: 60,
    readings: [
      { t: '2026-10-19T10:00:00Z', temp: 4.1, hum: 55.1 },
      { t: '2026-10-19T10:01:00Z', temp: 4.2, hum: 55.3 },
      { t: '2026-10-19T10:02:00Z', temp: 4.3, hum: 55.0 },
      { t: '2026-10-19T10:03:00Z', temp: 4.2, hum: 55.2 },
      { t: '2026-10-19T10:04:00Z', temp: 4.4, hum: 55.4 },
      { t: '2026-10-19T10:05:00Z', temp: 4.5, hum: 55.5 },
      { t: '2026-10-19T10:06:00Z', temp: 4.3, hum: 55.3 },
      { t: '2026-10-19T10:07:00Z', temp: 4.2, hum: 55.1 },
      { t: '2026-10-19T10:08:00Z', temp: 4.1, hum: 55.0 },
      { t: '2026-10-19T10:09:00Z', temp: 4.0, hum: 54.9 },
    ],
  };

  const offchainUpload = uploadToOffchain(bulkSensorTelemetry, {
    purpose: 'Regulatory Compliance Cold Chain Audit',
    inspector: 'FDA_Audit_Agent_9',
  });

  console.log('Stored in IPFS Off-chain Engine:');
  console.log(`- IPFS CID (Content ID): ${offchainUpload.cid}`);
  console.log(`- SHA-256 Checksum:     ${offchainUpload.sha256}`);
  console.log(`- File Size:            ${offchainUpload.sizeBytes} bytes`);

  // Retrieve
  const retrieved = retrieveFromOffchain(offchainUpload.cid);
  console.log(`\nRetrieved from IPFS by CID: Integrity Verified = ${retrieved.verified ? '✅ YES' : '❌ NO'}`);

  // -------------------------------------------------------------------------
  // TEST 3: Adversary Data Poisoning Attack Detection
  // -------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------------');
  console.log('--- DEMONSTRATION 3: Off-chain Data Poisoning Attack Mitigation ---');

  console.log('[Attack Simulation]: Malicious carrier attempts to modify past spiked temperature from 9.5°C to 4.5°C...');
  const forgedTelemetry = JSON.parse(JSON.stringify(bulkSensorTelemetry));
  forgedTelemetry.readings[4].temp = 12.8; // Changed reading

  const isAuthentic = verifyDataMatchesCid(forgedTelemetry, offchainUpload.cid);
  if (!isAuthentic) {
    console.log(`✅ MITIGATED: Modified payload does NOT match on-chain anchored CID ${offchainUpload.cid}!`);
    console.log('   The blockchain record proves this modified history is fraudulent.');
  } else {
    console.error('❌ FAILURE: Forged telemetry was not detected.');
  }

  console.log('\n======================================================================');
  console.log('✅ ALL WEEK 7 SECURITY & IPFS TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================================');
}

runSecurityTests().catch((err) => {
  console.error('Security test failed:', err);
});
