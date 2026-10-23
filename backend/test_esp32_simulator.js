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
  console.log('📡 STARTING ESP32 + DHT11 HARDWARE SIMULATION');
  console.log('==================================================');

  // Step 1: Create Batch
  console.log(`\n1. Registering new batch: ${BATCH_ID}...`);
  const createRes = await sendRequest('POST', '/api/batch/create', {
    id: BATCH_ID,
    drugName: 'COVID-19 Vaccine (mRNA)',
    manufacturer: 'Moderna',
  });
  console.log('Response:', createRes.status, JSON.stringify(createRes.body, null, 2));

  // Step 2: ESP32 sends normal temperature (4.2°C)
  console.log(`\n2. ESP32 Sensor sending Reading #1 (4.2°C - Normal)...`);
  const temp1Res = await sendRequest('POST', '/api/iot/temperature', {
    batchId: BATCH_ID,
    temperature: 4.2,
    humidity: 55.4,
    reporter: 'ESP32_DHT11_Unit01',
  });
  console.log('Response:', temp1Res.status, JSON.stringify(temp1Res.body, null, 2));

  await new Promise((r) => setTimeout(r, 2000));

  // Step 3: ESP32 sends spiked temperature (9.8°C - Excursion!)
  console.log(`\n3. ESP32 Sensor sending Reading #2 (9.8°C - EXCURSION DETECTED!)...`);
  const temp2Res = await sendRequest('POST', '/api/iot/temperature', {
    batchId: BATCH_ID,
    temperature: 9.8,
    humidity: 62.1,
    reporter: 'ESP32_DHT11_Unit01',
  });
  console.log('Response:', temp2Res.status, JSON.stringify(temp2Res.body, null, 2));

  await new Promise((r) => setTimeout(r, 2000));

  // Step 4: Query full batch state
  console.log(`\n4. Querying final Blockchain state for ${BATCH_ID}...`);
  const queryRes = await sendRequest('GET', `/api/batch/${BATCH_ID}`);
  console.log('Final State:', JSON.stringify(queryRes.body, null, 2));

  // Step 5: Query audit history
  console.log(`\n5. Querying complete Blockchain History for ${BATCH_ID}...`);
  const historyRes = await sendRequest('GET', `/api/batch/${BATCH_ID}/history`);
  console.log('History Records Count:', historyRes.body.data ? historyRes.body.data.length : 0);

  console.log('\n==================================================');
  console.log('✅ ESP32 SIMULATION FINISHED SUCCESSFULLY!');
  console.log('==================================================');
}

runSimulation().catch((err) => {
  console.error('Simulation Failed:', err);
});
