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
 * Resolves device-to-batch assignment if batchId is not provided.
 */
async function processTelemetryMessage(payload) {
  const { batchId, id, sensor_id, deviceId, temperature, humidity, reporter, timestamp } = payload;
  const explicitBatchId = batchId || id;
  const deviceIdentifier = sensor_id || deviceId || reporter;

  if (temperature === undefined) {
    console.warn('[MQTT Ingestion] Ignored payload missing temperature:', payload);
    return;
  }

  const logTimestamp = timestamp || new Date().toISOString();
  const reporterId = deviceIdentifier || reporter || 'ESP32_MQTT_Sensor';
  const tempVal = String(temperature);
  const humVal = humidity !== undefined ? String(humidity) : '0';

  let targetBatchId = explicitBatchId;
  let gateway, client;
  try {
    const conn = await getContract();
    gateway = conn.gateway;
    client = conn.client;

    // 1. Device-to-Batch Resolution: If batchId not provided, resolve via blockchain
    if (!targetBatchId) {
      if (!deviceIdentifier) {
        console.warn('[MQTT Ingestion] Payload missing both batchId and sensor_id. Dropping message:', payload);
        return;
      }

      try {
        const assignmentBytes = await conn.contract.evaluateTransaction('GetDeviceAssignment', String(deviceIdentifier));
        const assignment = JSON.parse(new TextDecoder().decode(assignmentBytes));
        if (!assignment || !assignment.active || !assignment.batchId) {
          console.warn(`[MQTT Ingestion] Device '${deviceIdentifier}' has no active batch assignment. Dropping telemetry.`);
          return;
        }
        targetBatchId = assignment.batchId;
        console.log(`[MQTT Gateway] Resolved device '${deviceIdentifier}' -> Batch '${targetBatchId}'`);
      } catch (err) {
        console.warn(`[MQTT Ingestion] Failed to resolve device '${deviceIdentifier}' on blockchain: ${err.message}. Dropping telemetry.`);
        return;
      }
    } else {
      // If batchId was provided, ensure target batch exists on blockchain
      try {
        await conn.contract.evaluateTransaction('QueryBatch', String(targetBatchId));
      } catch (err) {
        console.warn(`[MQTT Ingestion] Batch '${targetBatchId}' does not exist on blockchain. Dropping telemetry.`);
        return;
      }
    }

    // 2. Submit telemetry to Fabric using LogTelemetry (or fallback to LogTemperature)
    console.log(`[MQTT Fabric] Submitting LogTelemetry for ${targetBatchId}: ${tempVal}°C, ${humVal}% at ${logTimestamp} (Device: ${reporterId})`);
    try {
      await conn.contract.submitTransaction('LogTelemetry', targetBatchId, logTimestamp, tempVal, humVal, reporterId);
    } catch (_) {
      await conn.contract.submitTransaction('LogTemperature', targetBatchId, logTimestamp, tempVal, reporterId);
    }

    // 3. Query state to check for excursion
    const resultBytes = await conn.contract.evaluateTransaction('QueryBatch', targetBatchId);
    const updatedBatch = JSON.parse(new TextDecoder().decode(resultBytes));

    console.log(`[MQTT Fabric] Successfully committed to Blockchain for ${targetBatchId}. Excursion Alert: ${updatedBatch.excursionAlert}`);

    // 4. If temperature excursion occurred, publish immediate alert over MQTT back to IoT devices
    if (updatedBatch.excursionAlert && mqttClient) {
      const minThreshold = updatedBatch.minTemp !== undefined ? updatedBatch.minTemp : 2.0;
      const maxThreshold = updatedBatch.maxTemp !== undefined ? updatedBatch.maxTemp : 8.0;
      const alertMsg = JSON.stringify({
        alert: true,
        type: 'TEMPERATURE_EXCURSION',
        batchId: targetBatchId,
        deviceId: reporterId,
        temperature: Number(temperature),
        humidity: Number(humidity) || 0,
        thresholdRange: `${minThreshold}°C - ${maxThreshold}°C`,
        timestamp: logTimestamp,
        currentOwner: updatedBatch.currentOwner,
        message: `CRITICAL: Excursion detected for batch ${targetBatchId} (${tempVal}°C, allowed: ${minThreshold}-${maxThreshold}°C)!`,
      });

      mqttClient.publish('coldchain/alerts', alertMsg);
      mqttClient.publish(`coldchain/${targetBatchId}/alert`, alertMsg);
      mqttClient.publish(`coldchain/${reporterId}/alert`, alertMsg);
      console.log(`[MQTT Alert] 🚨 Excursion broadcast published for batch ${targetBatchId} and device ${reporterId}`);
    }
  } catch (error) {
    console.error(`[MQTT Fabric] Blockchain transaction failed for ${targetBatchId || deviceIdentifier}:`, error.message);
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
