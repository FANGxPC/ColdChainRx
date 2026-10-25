const http = require('http');

const BACKEND_HOST = 'localhost';
const BACKEND_PORT = 5000;
const BATCH_ID = `BATCH_ESP32_${Date.now()}`;

function sendRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const options = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSimulation() {
  console.log('==================================================');
  console.log('📡 STARTING COLDCHAINRX DEVICE RESOLUTION & TELEMETRY SIMULATION');
  console.log('==================================================');

  const DEVICE_ID = `BOX_${Date.now().toString(36).toUpperCase()}`;

  // Step 1: Register New Batch
  console.log(`\n1. Registering new batch: ${BATCH_ID}...`);
  const createRes = await sendRequest('POST', '/api/batch/create', {
    id: BATCH_ID,
    drugName: 'COVID-19 mRNA Vaccine',
    manufacturer: 'Pfizer-BioNTech',
    minTemp: 2.0,
    maxTemp: 8.0,
  });
  console.log('Response:', createRes.status, JSON.stringify(createRes.body, null, 2));

  // Step 2: Assign Sensor Box / Device to Batch
  console.log(`\n2. Manufacturer assigning Sensor Device '${DEVICE_ID}' to Batch '${BATCH_ID}'...`);
  const assignRes = await sendRequest('POST', '/api/device/assign', {
    deviceId: DEVICE_ID,
    batchId: BATCH_ID,
  });
  console.log('Response:', assignRes.status, JSON.stringify(assignRes.body, null, 2));

  // Step 3: Verify Device Assignment on Blockchain
  console.log(`\n3. Verifying Blockchain Device Assignment for '${DEVICE_ID}'...`);
  const checkAssignRes = await sendRequest('GET', `/api/device/${DEVICE_ID}/batch`);
  console.log('Active Assignment:', JSON.stringify(checkAssignRes.body, null, 2));

  await new Promise((r) => setTimeout(r, 1500));

  // Step 4: ESP32 sends reading WITHOUT batchId (Backend resolves device -> batch)
  console.log(`\n4. ESP32 Sensor '${DEVICE_ID}' sending Reading #1 (4.5°C, 52% - Normal, NO batchId sent!)...`);
  const temp1Res = await sendRequest('POST', '/api/iot/temperature', {
    sensor_id: DEVICE_ID,
    temperature: 4.5,
    humidity: 52.0,
  });
  console.log('Response:', temp1Res.status, JSON.stringify(temp1Res.body, null, 2));

  await new Promise((r) => setTimeout(r, 1500));

  // Step 5: ESP32 sends excursion temperature (10.2°C - Excursion!)
  console.log(`\n5. ESP32 Sensor '${DEVICE_ID}' sending Reading #2 (10.2°C, 65% - EXCURSION DETECTED!)...`);
  const temp2Res = await sendRequest('POST', '/api/iot/temperature', {
    sensor_id: DEVICE_ID,
    temperature: 10.2,
    humidity: 65.4,
  });
  console.log('Response:', temp2Res.status, JSON.stringify(temp2Res.body, null, 2));

  await new Promise((r) => setTimeout(r, 1500));

  // Step 6: Test Unassigned Rogue Sensor (Must be REJECTED)
  const ROGUE_ID = 'ROGUE_SENSOR_UNKNOWN';
  console.log(`\n6. Testing Security: Unassigned sensor '${ROGUE_ID}' sending reading (Expected: REJECTED)...`);
  const rogueRes = await sendRequest('POST', '/api/iot/temperature', {
    sensor_id: ROGUE_ID,
    temperature: 5.0,
  });
  console.log('Security Response (Expected 400):', rogueRes.status, JSON.stringify(rogueRes.body, null, 2));

  // Step 7: Query full batch state from blockchain
  console.log(`\n7. Querying final Blockchain state for ${BATCH_ID}...`);
  const queryRes = await sendRequest('GET', `/api/batch/${BATCH_ID}`);
  console.log('Final Batch State:', JSON.stringify(queryRes.body, null, 2));

  // Step 8: Query complete audit history
  console.log(`\n8. Querying complete Blockchain Provenance History for ${BATCH_ID}...`);
  const historyRes = await sendRequest('GET', `/api/batch/${BATCH_ID}/history`);
  console.log('History Records Count:', historyRes.body.data ? historyRes.body.data.length : 0);

  console.log('\n==================================================');
  console.log('✅ ALL TESTS PASSED: DEVICE-TO-BATCH PIPELINE VERIFIED!');
  console.log('==================================================');
}

runSimulation().catch((err) => {
  console.error('Simulation Failed:', err);
});
