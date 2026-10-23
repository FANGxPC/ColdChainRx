const net = require('net');
const mqtt = require('mqtt');
const { Aedes } = require('aedes');
const { getContract } = require('../fabricGateway');
require('dotenv').config();

const MQTT_PORT = parseInt(process.env.MQTT_PORT, 10) || 1883;
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || `mqtt://localhost:${MQTT_PORT}`;
const ENABLE_EMBEDDED_BROKER = process.env.ENABLE_EMBEDDED_MQTT !== 'false';

let aedesServer = null;
let mqttClient = null;

/**
 * Start the MQTT service:
 * 1. Starts an embedded Aedes MQTT broker on MQTT_PORT (if enabled)
 * 2. Connects a subscriber client to process incoming IoT messages and commit them to Fabric
 */
async function startMqttService() {
  if (ENABLE_EMBEDDED_BROKER) {
    try {
      const aedes = await Aedes.createBroker();
      aedesServer = net.createServer(aedes.handle);

      await new Promise((resolve, reject) => {
        aedesServer.listen(MQTT_PORT, '0.0.0.0', (err) => {
          if (err) return reject(err);
          console.log(`[MQTT] 🛰️  Embedded Aedes MQTT Broker listening on port ${MQTT_PORT}`);
          resolve();
        });
      });

      aedes.on('client', (client) => {
        console.log(`[MQTT Broker] Client connected: ${client ? client.id : 'unknown'}`);
      });

      aedes.on('clientDisconnect', (client) => {
        console.log(`[MQTT Broker] Client disconnected: ${client ? client.id : 'unknown'}`);
      });
    } catch (err) {
      console.warn(`[MQTT] Could not start embedded broker (port ${MQTT_PORT} may be in use or external broker active):`, err.message);
    }
  }

  // Connect subscriber client
  mqttClient = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `ColdChainRx_Fabric_Bridge_${Math.random().toString(16).slice(2, 8)}`,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
  });

  mqttClient.on('connect', () => {
    console.log(`[MQTT Client] Connected to MQTT broker at ${MQTT_BROKER_URL}`);
    const topics = [
      'coldchain/telemetry',
      'coldchain/sensors/temperature',
      'coldchain/+/telemetry',
    ];
    mqttClient.subscribe(topics, (err) => {
      if (!err) {
        console.log(`[MQTT Client] Subscribed to IoT topics: ${topics.join(', ')}`);
      } else {
        console.error('[MQTT Client] Subscription error:', err);
      }
    });
  });

  mqttClient.on('message', async (topic, message) => {
    const rawStr = message.toString();
    console.log(`[MQTT Ingestion] Received message on topic [${topic}]: ${rawStr}`);

    try {
      const payload = JSON.parse(rawStr);
      await processTelemetryMessage(payload);
    } catch (err) {
      console.error(`[MQTT Ingestion] Error processing message on [${topic}]:`, err.message);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('[MQTT Client] Connection error:', err.message);
  });

  return { aedesServer, mqttClient };
}

/**
 * Process incoming sensor payload and commit to Fabric Blockchain
 */
async function processTelemetryMessage(payload) {
  const { batchId, id, sensor_id, temperature, humidity, reporter, timestamp } = payload;
  const targetId = batchId || id || sensor_id;

  if (!targetId || temperature === undefined) {
    console.warn('[MQTT Ingestion] Ignored payload missing batchId or temperature:', payload);
    return;
  }

  const logTimestamp = timestamp || new Date().toISOString();
  const reporterId = reporter || sensor_id || 'ESP32_MQTT_Sensor';
  const tempVal = String(temperature);

  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    // Check if batch exists; auto-create if new
    try {
      await conn.contract.evaluateTransaction('QueryBatch', targetId);
    } catch (err) {
      console.log(`[MQTT Fabric] Batch '${targetId}' not found. Auto-creating on ledger...`);
      await conn.contract.submitTransaction('CreateBatch', targetId, 'Medical Cold Chain Supply', 'DefaultManufacturer');
    }

    // Submit temperature log to Fabric
    console.log(`[MQTT Fabric] Submitting LogTemperature for ${targetId}: ${tempVal}°C at ${logTimestamp}`);
    await conn.contract.submitTransaction('LogTemperature', targetId, logTimestamp, tempVal, reporterId);

    // Query state to check for excursion
    const resultBytes = await conn.contract.evaluateTransaction('QueryBatch', targetId);
    const updatedBatch = JSON.parse(new TextDecoder().decode(resultBytes));

    console.log(`[MQTT Fabric] Successfully committed to Blockchain for ${targetId}. Excursion Alert: ${updatedBatch.excursionAlert}`);

    // If temperature excursion occurred, publish immediate alert over MQTT back to IoT devices
    if (updatedBatch.excursionAlert && mqttClient) {
      const alertMsg = JSON.stringify({
        alert: true,
        type: 'TEMPERATURE_EXCURSION',
        batchId: targetId,
        temperature: Number(temperature),
        thresholdRange: '2.0C - 8.0C',
        timestamp: logTimestamp,
        currentOwner: updatedBatch.currentOwner,
        message: `CRITICAL: Excursion detected for batch ${targetId} (${tempVal}°C)!`,
      });

      mqttClient.publish('coldchain/alerts', alertMsg);
      mqttClient.publish(`coldchain/${targetId}/alert`, alertMsg);
      console.log(`[MQTT Alert] 🚨 Excursion broadcast published for ${targetId}`);
    }
  } catch (error) {
    console.error(`[MQTT Fabric] Blockchain transaction failed for ${targetId}:`, error.message);
  } finally {
    if (gateway) gateway.close();
    if (client) client.close();
  }
}

function getMqttClient() {
  return mqttClient;
}

module.exports = {
  startMqttService,
  processTelemetryMessage,
  getMqttClient,
};
