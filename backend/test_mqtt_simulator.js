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

let alertsReceived = 0;

client.on('connect', async () => {
  console.log('✅ MQTT Simulator connected successfully.\n');

  // Subscribe to alert topics to listen for blockchain feedback
  client.subscribe([ALERT_TOPIC, GLOBAL_ALERT_TOPIC], (err) => {
    if (err) {
      console.error('Failed to subscribe to alerts:', err);
    } else {
      console.log(`🎧 Listening for real-time excursion alerts on: ${ALERT_TOPIC} & ${GLOBAL_ALERT_TOPIC}\n`);
    }
  });

  // Step 1: Send normal temperature reading
  console.log('1. Publishing Reading #1: 4.5°C (SAFE: Within 2°C - 8°C)...');
  const payload1 = {
    batchId: BATCH_ID,
    temperature: 4.5,
    humidity: 52.3,
    reporter: 'ESP32_DHT22_Truck_Alpha',
    timestamp: new Date().toISOString(),
  };
  client.publish(TELEMETRY_TOPIC, JSON.stringify(payload1), { qos: 1 });
  console.log(`Published to [${TELEMETRY_TOPIC}]:`, payload1);

  // Wait 3 seconds
  await new Promise((r) => setTimeout(r, 3000));

  // Step 2: Send spiked temperature reading
  console.log('\n2. Publishing Reading #2: 11.5°C (CRITICAL EXCURSION: Spoilage risk!)...');
  const payload2 = {
    batchId: BATCH_ID,
    temperature: 11.5,
    humidity: 68.7,
    reporter: 'ESP32_DHT22_Truck_Alpha',
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
