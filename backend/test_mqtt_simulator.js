const mqtt = require('mqtt');

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const BATCH_ID = `BATCH_MQTT_${Date.now()}`;
const TELEMETRY_TOPIC = 'coldchain/telemetry';
const ALERT_TOPIC = `coldchain/${BATCH_ID}/alert`;
const GLOBAL_ALERT_TOPIC = 'coldchain/alerts';

console.log('==================================================');
console.log('📡 STARTING ESP32 / OMKAR MQTT SENSOR SIMULATION');
console.log(`Connecting to MQTT broker: ${MQTT_BROKER_URL}`);
console.log(`Simulated Batch ID: ${BATCH_ID}`);
console.log('==================================================\n');

const client = mqtt.connect(MQTT_BROKER_URL, {
  clientId: `ESP32_Simulator_${Date.now()}`,
  clean: true,
});

const DEVICE_ID = 'ESP32_DHT22_Truck_Alpha';
const DEVICE_ALERT_TOPIC = `coldchain/${DEVICE_ID}/alert`;

let alertsReceived = 0;

async function setupBatchAndAssignment() {
  const http = require('http');
  function post(path, body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      }, (res) => {
        let out = '';
        res.on('data', c => out += c);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(out) }));
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  console.log(`Setting up batch '${BATCH_ID}' and assigning device '${DEVICE_ID}'...`);
  await post('/api/batch/create', { id: BATCH_ID, drugName: 'Vaccine-MQTT-Fleet', manufacturer: 'GSK' });
  await post('/api/device/assign', { deviceId: DEVICE_ID, batchId: BATCH_ID });
  console.log('✅ Batch and device assignment registered on Fabric.\n');
}

client.on('connect', async () => {
  console.log('✅ MQTT Simulator connected successfully.\n');

  try {
    await setupBatchAndAssignment();
  } catch (e) {
    console.error('Setup error:', e.message);
  }

  // Subscribe to alert topics to listen for blockchain feedback
  client.subscribe([ALERT_TOPIC, GLOBAL_ALERT_TOPIC, DEVICE_ALERT_TOPIC], (err) => {
    if (err) {
      console.error('Failed to subscribe to alerts:', err);
    } else {
      console.log(`🎧 Listening for real-time excursion alerts on: ${ALERT_TOPIC}, ${GLOBAL_ALERT_TOPIC}, & ${DEVICE_ALERT_TOPIC}\n`);
    }
  });

  // Step 1: Send normal temperature reading (NO batchId, only sensor_id)
  console.log('1. Publishing Reading #1: 4.5°C (SAFE) using only sensor_id (NO batchId)...');
  const payload1 = {
    sensor_id: DEVICE_ID,
    temperature: 4.5,
    humidity: 52.3,
    timestamp: new Date().toISOString(),
  };
  client.publish(TELEMETRY_TOPIC, JSON.stringify(payload1), { qos: 1 });
  console.log(`Published to [${TELEMETRY_TOPIC}]:`, payload1);

  // Wait 3 seconds
  await new Promise((r) => setTimeout(r, 3000));

  // Step 2: Send spiked temperature reading (CRITICAL EXCURSION)
  console.log('\n2. Publishing Reading #2: 11.5°C (EXCURSION) using only sensor_id...');
  const payload2 = {
    sensor_id: DEVICE_ID,
    temperature: 11.5,
    humidity: 68.7,
    timestamp: new Date().toISOString(),
  };
  client.publish(TELEMETRY_TOPIC, JSON.stringify(payload2), { qos: 1 });
  console.log(`Published to [${TELEMETRY_TOPIC}]:`, payload2);

  // Wait 4 seconds for alert response
  await new Promise((r) => setTimeout(r, 4000));

  console.log('\n==================================================');
  console.log(`🏁 SIMULATION COMPLETE. Total Excursion Alerts Received: ${alertsReceived}`);
  console.log('==================================================');

  client.end();
  process.exit(0);
});

client.on('message', (topic, message) => {
  alertsReceived++;
  console.log(`\n🚨 [ALARM RECEIVED via MQTT on ${topic}]:`);
  try {
    const alertData = JSON.parse(message.toString());
    console.log(JSON.stringify(alertData, null, 2));
  } catch (e) {
    console.log(message.toString());
  }
});

client.on('error', (err) => {
  console.error('MQTT Simulator Error:', err.message);
});
