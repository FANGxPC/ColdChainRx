const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/apiRoutes');
const { startMqttService } = require('./services/mqttService');

const app = express();
const PORT = process.env.PORT || 5000;
const MQTT_PORT = process.env.MQTT_PORT || 1883;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'ColdChainRx Backend Gateway',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api', apiRoutes);

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`==================================================`);
  console.log(`🚀 ColdChainRx Backend Gateway listening on port ${PORT}`);
  console.log(`📡 Local REST URL: http://localhost:${PORT}`);
  console.log(`🌡️  IoT REST Endpoint: http://localhost:${PORT}/api/iot/temperature`);
  
  // Start MQTT broker and gateway subscriber
  try {
    await startMqttService();
    console.log(`🛰️  IoT MQTT Broker:  mqtt://localhost:${MQTT_PORT}`);
    console.log(`🔔 MQTT Topics:      coldchain/telemetry, coldchain/alerts`);
  } catch (mqttErr) {
    console.warn(`[Warning] Could not initialize MQTT broker:`, mqttErr.message);
  }
  
  console.log(`==================================================`);
});

