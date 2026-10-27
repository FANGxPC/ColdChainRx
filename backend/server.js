const express = require('express');
const QRCode = require('qrcode');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
// Load single shared root .env file
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config(); // Fallback for current working directory

const app = express();

// ---------------------------------------------------------------------------
// Swagata's Fabric backend base URL
// Reads from env first (set FABRIC_BACKEND_URL in root .env)
// Trailing slashes are stripped to avoid double-slash route mismatch on Fabric
// ---------------------------------------------------------------------------
const SWAGATA_BASE = (process.env.FABRIC_BACKEND_URL || 'http://10.194.253.204:5000').replace(/\/+$/, '');
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
const ML_BASE = (process.env.ML_SERVICE_URL || 'http://localhost:5001').replace(/\/+$/, '');

// ---------------------------------------------------------------------------
// Cold-chain business rules (kept in one place)
// ---------------------------------------------------------------------------
const SAFE_MIN = 2;   // °C
const SAFE_MAX = 8;   // °C
const MEAN_HUMIDITY = 76.6; // mean from training dataset – used when ledger has no humidity

// --- Security Middleware (Week 7 Hardening) ---

// 1. Helmet: Sets secure HTTP headers to prevent XSS, clickjacking, etc.
app.use(helmet());

// 2. CORS: Restrict origin to frontend for production, but allow all for local dev
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50kb' })); // Mitigate DoS by limiting payload size

// 3. Morgan: Request logging for audit trails
app.use(morgan('combined'));

// 4. Rate Limiting: Mitigate DoS and brute-force API scraping
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // High limit to allow dashboard auto-polling
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

const verifyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Limit consumer verify endpoints to 100 requests per 5 mins
    message: { success: false, error: 'Too many verification attempts, please wait.' }
});

// Apply rate limiters to routes
app.use('/api/', apiLimiter);
app.use('/verify/', verifyLimiter);

// 5. Input Validation Middleware
// Accepts Swagata's format: BATCH_1792760493 (underscores allowed) + legacy hyphens
function validateBatchId(req, res, next) {
    const id = req.params.batchId || req.params.id;
    const batchIdRegex = /^[A-Za-z0-9_\-]{3,50}$/;
    if (!batchIdRegex.test(id)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Batch ID format. Alphanumeric, hyphens, and underscores only (3–50 chars).'
        });
    }
    next();
}

const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Mock database – kept as a fallback when the ledger is unreachable
// ---------------------------------------------------------------------------
const mockTelemetryDatasets = {
  standard: {
    batchId: "BATCH-V2026-001",
    drugName: "COVID-19 MRNA Vaccine (Standard Cold)",
    manufacturer: "PharmaCorp Global",
    mfgDate: "2026-08-15",
    expiryDate: "2027-08-15",
    requiredTempMin: SAFE_MIN,
    requiredTempMax: SAFE_MAX,
    unit: "°C",
    status: "Authentic & Safe",
    storageType: "Refrigerated Cold Storage (2°C - 8°C)",
    readings: [
      { time: "08:00", temp: 4.2, humidity: 45, location: "Mfg Hub - Kalamazoo", hop: "Manufacturer Warehouse", status: "NORMAL" },
      { time: "09:00", temp: 4.5, humidity: 46, location: "Mfg Hub - Kalamazoo", hop: "Manufacturer Warehouse", status: "NORMAL" },
      { time: "10:00", temp: 4.1, humidity: 44, location: "Reefer Truck #402", hop: "Transit to Airport", status: "NORMAL" },
      { time: "11:00", temp: 5.0, humidity: 48, location: "Reefer Truck #402", hop: "Transit to Airport", status: "NORMAL" },
      { time: "12:00", temp: 5.3, humidity: 47, location: "Air Cargo Hub GRR", hop: "Airport Storage", status: "NORMAL" },
      { time: "13:00", temp: 4.8, humidity: 45, location: "Air Cargo Hub GRR", hop: "Airport Storage", status: "NORMAL" },
      { time: "14:00", temp: 4.6, humidity: 44, location: "Air Cargo Flight AC-809", hop: "In Air Transit", status: "NORMAL" },
      { time: "15:00", temp: 4.4, humidity: 43, location: "Air Cargo Flight AC-809", hop: "In Air Transit", status: "NORMAL" },
      { time: "16:00", temp: 4.9, humidity: 45, location: "Regional Hub ORD", hop: "Distributor Warehouse", status: "NORMAL" },
      { time: "17:00", temp: 5.1, humidity: 46, location: "Regional Hub ORD", hop: "Distributor Warehouse", status: "NORMAL" },
      { time: "18:00", temp: 4.7, humidity: 45, location: "Last-Mile Delivery Van", hop: "Pharmacy Transit", status: "NORMAL" },
      { time: "19:00", temp: 4.3, humidity: 44, location: "Apex Pharmacy - Chicago", hop: "Retail Dispensing", status: "NORMAL" }
    ]
  },
  excursion: {
    batchId: "BATCH-V2026-EXC",
    drugName: "Rotavirus Oral Vaccine (Excursion Warning)",
    manufacturer: "BioLife Systems",
    mfgDate: "2026-08-20",
    expiryDate: "2027-02-20",
    requiredTempMin: SAFE_MIN,
    requiredTempMax: SAFE_MAX,
    unit: "°C",
    status: "Temperature Breach Detected",
    storageType: "Refrigerated Cold Storage (2°C - 8°C)",
    readings: [
      { time: "08:00", temp: 4.0, humidity: 45, location: "Source Hub", hop: "Storage", status: "NORMAL" },
      { time: "09:00", temp: 4.2, humidity: 46, location: "Source Hub", hop: "Storage", status: "NORMAL" },
      { time: "10:00", temp: 5.8, humidity: 50, location: "Reefer Truck #105", hop: "Transit", status: "NORMAL" },
      { time: "11:00", temp: 7.9, humidity: 58, location: "Reefer Truck #105", hop: "Transit", status: "WARNING" },
      { time: "12:00", temp: 11.4, humidity: 68, location: "Reefer Truck #105 (Cooling Unit Failure)", hop: "Transit Breach", status: "CRITICAL_EXCURSION" },
      { time: "13:00", temp: 13.2, humidity: 72, location: "Reefer Truck #105 (Cooling Unit Failure)", hop: "Transit Breach", status: "CRITICAL_EXCURSION" },
      { time: "14:00", temp: 9.5, humidity: 61, location: "Emergency Transfer Unit", hop: "Recovery Hop", status: "CRITICAL_EXCURSION" },
      { time: "15:00", temp: 6.1, humidity: 52, location: "Depot Freezer", hop: "Warehouse Storage", status: "NORMAL" },
      { time: "16:00", temp: 4.8, humidity: 47, location: "Depot Freezer", hop: "Warehouse Storage", status: "NORMAL" },
      { time: "17:00", temp: 4.5, humidity: 45, location: "Depot Freezer", hop: "Warehouse Storage", status: "NORMAL" }
    ]
  },
  ultralow: {
    batchId: "BATCH-ULTRA-70",
    drugName: "Ultra-Low Temperature MRNA Vaccine",
    manufacturer: "Genetics Lab Int",
    mfgDate: "2026-09-01",
    expiryDate: "2027-09-01",
    requiredTempMin: -80,
    requiredTempMax: -60,
    unit: "°C",
    status: "Authentic & Verified",
    storageType: "Ultra-Low Cryo Freezer (-80°C to -60°C)",
    readings: [
      { time: "00:00", temp: -71.5, humidity: 90, location: "Cryo Storage Plant", hop: "Ultra-Low Vault", status: "NORMAL" },
      { time: "02:00", temp: -70.8, humidity: 91, location: "Cryo Storage Plant", hop: "Ultra-Low Vault", status: "NORMAL" },
      { time: "04:00", temp: -69.4, humidity: 90, location: "Dry Ice Shipper Unit", hop: "Cryo Transport", status: "NORMAL" },
      { time: "06:00", temp: -71.2, humidity: 92, location: "Dry Ice Shipper Unit", hop: "Cryo Transport", status: "NORMAL" },
      { time: "08:00", temp: -70.1, humidity: 89, location: "Air Cargo Vault", hop: "Air Transit", status: "NORMAL" },
      { time: "10:00", temp: -68.5, humidity: 90, location: "Air Cargo Vault", hop: "Air Transit", status: "NORMAL" },
      { time: "12:00", temp: -70.9, humidity: 91, location: "Central Hospital Freezer", hop: "Dispensing Vault", status: "NORMAL" }
    ]
  },
  batch001: {
    batchId: "BATCH001",
    id: "BATCH001",
    drugName: "Covishield",
    manufacturer: "Serum Institute of India",
    currentOwner: "Manufacturer",
    assignedDevice: "ESP32_BOX_01",
    deviceId: "ESP32_BOX_01",
    mfgDate: "2026-10-27",
    expiryDate: "2027-10-27",
    requiredTempMin: SAFE_MIN,
    requiredTempMax: SAFE_MAX,
    minTemp: SAFE_MIN,
    maxTemp: SAFE_MAX,
    unit: "°C",
    status: "IN_TRANSIT",
    storageType: "Refrigerated Cold Storage (2°C - 8°C)",
    excursionAlert: false,
    readings: [
      { time: "14:00", temp: 4.8, humidity: 60.0, location: "ESP32_BOX_01", hop: "Manufactured", status: "NORMAL", timestamp: "2026-10-27T14:00:00Z" },
      { time: "14:30", temp: 5.1, humidity: 59.5, location: "ESP32_BOX_01", hop: "In Transit", status: "NORMAL", timestamp: "2026-10-27T14:30:00Z" },
      { time: "15:00", temp: 4.9, humidity: 61.2, location: "ESP32_BOX_01", hop: "In Transit", status: "NORMAL", timestamp: "2026-10-27T15:00:00Z" }
    ]
  },
  seeded: {
    batchId: "BATCH001",
    id: "BATCH001",
    drugName: "Covishield",
    manufacturer: "Serum Institute of India",
    currentOwner: "Manufacturer",
    assignedDevice: "ESP32_BOX_01",
    deviceId: "ESP32_BOX_01",
    mfgDate: "2026-10-27",
    expiryDate: "2027-10-27",
    requiredTempMin: 2,
    requiredTempMax: 8,
    minTemp: 2.0,
    maxTemp: 8.0,
    unit: "°C",
    status: "IN_TRANSIT",
    storageType: "Refrigerated Cold Storage (2°C - 8°C)",
    excursionAlert: false,
    readings: [
      { time: "14:00", temp: 4.8, humidity: 60.0, location: "ESP32_BOX_01", hop: "Manufactured", status: "NORMAL", timestamp: "2026-10-27T14:00:00Z" },
      { time: "14:30", temp: 5.1, humidity: 59.5, location: "ESP32_BOX_01", hop: "In Transit", status: "NORMAL", timestamp: "2026-10-27T14:30:00Z" },
      { time: "15:00", temp: 4.9, humidity: 61.2, location: "ESP32_BOX_01", hop: "In Transit", status: "NORMAL", timestamp: "2026-10-27T15:00:00Z" },
    ]
  }
};

// ---------------------------------------------------------------------------
// Helper: Convert Swagata's batch JSON → the shape the UI and chart expect
// ---------------------------------------------------------------------------
function mapSwagataBatch(raw) {
  const minTemp = (typeof raw.minTemp === 'number') ? raw.minTemp : SAFE_MIN;
  const maxTemp = (typeof raw.maxTemp === 'number') ? raw.maxTemp : SAFE_MAX;
  const batchId = raw.batchId || raw.id || 'BATCH001';
  const deviceId = raw.deviceId || raw.assignedDevice || 'ESP32_BOX_01';

  const readings = (raw.temperatureLogs || []).map((log) => {
    const temp = log.temperature;
    let readingStatus = 'NORMAL';
    if (temp > maxTemp) readingStatus = 'CRITICAL_EXCURSION';
    else if (temp >= maxTemp - 0.5) readingStatus = 'WARNING'; // within 0.5°C of ceiling
    else if (temp < minTemp) readingStatus = 'CRITICAL_EXCURSION';

    const hum = (log.humidity !== undefined && log.humidity !== null && !isNaN(log.humidity))
      ? Number(log.humidity)
      : MEAN_HUMIDITY;

    return {
      time: (() => {
        try {
          const d = new Date(log.timestamp);
          if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          }
        } catch (_) {}
        return String(log.timestamp || 'Live');
      })(),
      temp,
      humidity: hum,
      location: log.reporter || deviceId || 'ESP32_BOX_01',
      hop: raw.status || 'Ledger recorded',
      status: readingStatus,
      // Pass raw timestamp so the ML service can extract hour_of_day correctly
      timestamp: log.timestamp,
    };
  });

  const hasExcursion = raw.excursionAlert || readings.some((r) => r.status === 'CRITICAL_EXCURSION');

  return {
    batchId,
    id: batchId,
    drugName: raw.drugName || raw.drug || 'Covishield',
    manufacturer: raw.manufacturer || 'Serum Institute of India',
    currentOwner: raw.currentOwner || 'Manufacturer',
    assignedDevice: deviceId,
    deviceId: deviceId,
    mfgDate: raw.mfgDate || null,
    expiryDate: raw.expiryDate || raw.expDate || null,
    requiredTempMin: minTemp,
    requiredTempMax: maxTemp,
    minTemp,
    maxTemp,
    unit: '°C',
    status: raw.status || (hasExcursion ? 'Temperature Breach Detected' : 'IN_TRANSIT'),
    rawStatus: raw.status || 'IN_TRANSIT',
    storageType: minTemp < 0
      ? `Ultra-Low Cryo Storage (${minTemp}°C to ${maxTemp}°C)`
      : `Refrigerated Cold Storage (${minTemp}°C – ${maxTemp}°C)`,
    excursionAlert: hasExcursion,
    readings,
    temperatureLogs: raw.temperatureLogs || [],
    _live: true,  // flag to distinguish from mock data
  };
}

// ---------------------------------------------------------------------------
// Active In-Memory Registry of Batches and Device Associations
// Preserves newly created batches and assignments across Fabric queries
// ---------------------------------------------------------------------------
const trackedBatches = new Map();

// Seed primary production batches
trackedBatches.set('BATCH001', {
  id: 'BATCH001',
  batchId: 'BATCH001',
  drugName: 'Covishield Vaccine',
  manufacturer: 'Serum Institute of India',
  currentOwner: 'Manufacturer',
  assignedDevice: 'ESP32_BOX_01',
  deviceId: 'ESP32_BOX_01',
  minTemp: 2.0,
  maxTemp: 8.0,
  mfgDate: '2026-10-27',
  expDate: '2027-10-27',
  status: 'IN_TRANSIT',
  excursionAlert: false,
  quantity: 10000,
  createdAt: '2026-10-27T10:00:00Z',
  temperatureLogs: [
    { timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), temperature: 4.8, humidity: 60.0, reporter: 'ESP32_BOX_01' },
    { timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), temperature: 5.1, humidity: 59.5, reporter: 'ESP32_BOX_01' },
    { timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(), temperature: 4.9, humidity: 61.2, reporter: 'ESP32_BOX_01' }
  ]
});

trackedBatches.set('BATCH_1792760493', {
  id: 'BATCH_1792760493',
  batchId: 'BATCH_1792760493',
  drugName: 'Covishield Vaccine',
  manufacturer: 'Serum Institute of India',
  currentOwner: 'Serum Institute of India',
  assignedDevice: 'Sensor_Omkar_01',
  deviceId: 'Sensor_Omkar_01',
  minTemp: 2.0,
  maxTemp: 8.0,
  mfgDate: '2026-10-25',
  expDate: '2027-10-25',
  status: 'Manufactured',
  excursionAlert: false,
  quantity: 10000,
  createdAt: '2026-10-25T10:00:00Z',
  temperatureLogs: [
    { timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(), temperature: 4.8, humidity: 60.0, reporter: 'Sensor_Omkar_01' },
    { timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), temperature: 5.1, humidity: 59.5, reporter: 'Sensor_Omkar_01' },
    { timestamp: new Date(Date.now() - 1 * 60 * 1000).toISOString(), temperature: 4.9, humidity: 61.2, reporter: 'Sensor_Omkar_01' }
  ]
});

trackedBatches.set('BATCH-V2026-001', {
  id: 'BATCH-V2026-001',
  batchId: 'BATCH-V2026-001',
  drugName: 'COVID-19 mRNA Vaccine (Standard Cold)',
  manufacturer: 'PharmaCorp Global',
  currentOwner: 'Apex Pharmacy - Chicago',
  assignedDevice: 'BOX001',
  minTemp: 2.0,
  maxTemp: 8.0,
  mfgDate: '2026-08-15',
  expDate: '2027-08-15',
  status: 'Delivered',
  excursionAlert: false,
  quantity: 5000,
  createdAt: '2026-08-15T08:00:00Z',
  temperatureLogs: [
    { timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(), temperature: 4.3, humidity: 44.0, reporter: 'BOX001' }
  ]
});

trackedBatches.set('BATCH-V2026-EXC', {
  id: 'BATCH-V2026-EXC',
  batchId: 'BATCH-V2026-EXC',
  drugName: 'Rotavirus Oral Vaccine (Excursion Warning)',
  manufacturer: 'BioLife Systems',
  currentOwner: 'Depot Freezer Hub',
  assignedDevice: 'BOX002',
  minTemp: 2.0,
  maxTemp: 8.0,
  mfgDate: '2026-08-20',
  expDate: '2027-02-20',
  status: 'Quarantined',
  excursionAlert: true,
  quantity: 2500,
  createdAt: '2026-08-20T08:00:00Z',
  temperatureLogs: [
    { timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), temperature: 11.4, humidity: 68.0, reporter: 'BOX002' }
  ]
});

// Hardware device registry (known pool of sensors)
const knownDevices = new Map([
  ['ESP32_BOX_01', { deviceId: 'ESP32_BOX_01', assignedBatch: 'BATCH001', status: 'Assigned', model: 'ESP32 Smart Cooler Box v1', lastSeen: new Date().toISOString() }],
  ['Sensor_Omkar_01', { deviceId: 'Sensor_Omkar_01', assignedBatch: 'BATCH_1792760493', status: 'Assigned', model: 'ESP32-WROOM-32 + DHT22', lastSeen: new Date().toISOString() }],
  ['BOX001', { deviceId: 'BOX001', assignedBatch: 'BATCH-V2026-001', status: 'Assigned', model: 'ESP32 Smart Cooler Box v1', lastSeen: new Date().toISOString() }],
  ['BOX002', { deviceId: 'BOX002', assignedBatch: 'BATCH-V2026-EXC', status: 'Assigned', model: 'ESP32 Smart Cooler Box v1', lastSeen: new Date().toISOString() }],
  ['BOX003', { deviceId: 'BOX003', assignedBatch: null, status: 'Available', model: 'ESP32 Ultra-Low Cryo Shipper', lastSeen: new Date().toISOString() }]
]);

function registerTrackedBatch(id, data) {
  trackedBatches.set(id, {
    ...data,
    id,
    batchId: id,
    currentOwner: data.manufacturer || 'Manufacturer',
    status: data.status || 'Manufactured',
    assignedDevice: data.assignedDevice || 'Unassigned',
    temperatureLogs: data.temperatureLogs || [],
    createdAt: data.createdAt || new Date().toISOString()
  });
}

function updateDeviceAssignment(deviceId, batchId) {
  // If this device was previously assigned to another batch, detach it from the old batch
  for (const [bId, bRecord] of trackedBatches.entries()) {
    if (bRecord.assignedDevice === deviceId && bId !== batchId) {
      bRecord.assignedDevice = 'Unassigned';
    }
  }

  if (knownDevices.has(deviceId)) {
    const dev = knownDevices.get(deviceId);
    dev.assignedBatch = batchId;
    dev.status = batchId ? 'Assigned' : 'Available';
    dev.lastSeen = new Date().toISOString();
  } else {
    knownDevices.set(deviceId, {
      deviceId,
      assignedBatch: batchId,
      status: batchId ? 'Assigned' : 'Available',
      model: 'ESP32 Sensor Unit',
      lastSeen: new Date().toISOString()
    });
  }

  // Update batch assignedDevice
  if (batchId && trackedBatches.has(batchId)) {
    const b = trackedBatches.get(batchId);
    b.assignedDevice = deviceId;
  }
}

// ---------------------------------------------------------------------------
// GET /api/batches & /api/fabric/batches – List all batches with live status, device, & readings
// ---------------------------------------------------------------------------
app.get(['/api/batches', '/api/fabric/batches'], async (req, res) => {
  const result = [];

  for (const [id, localRecord] of trackedBatches.entries()) {
    let batchData = { ...localRecord };

    // Try fetching authoritative live data from Swagata's Fabric backend
    try {
      const response = await fetch(`${SWAGATA_BASE}/api/batch/${id}`);
      if (response.ok) {
        const json = await response.json();
        const mapped = mapSwagataBatch(json.data);
        let assignedDev = mapped.assignedDevice || localRecord.assignedDevice || 'Unassigned';
        // If local record or device registry was detached, ensure it stays Unassigned
        if (localRecord.assignedDevice === 'Unassigned' || mapped.assignedDevice === 'Unassigned') {
          assignedDev = 'Unassigned';
        } else if (assignedDev && assignedDev !== 'Unassigned') {
          const dev = knownDevices.get(assignedDev);
          if (dev && dev.status === 'Available' && dev.assignedBatch !== id) {
            assignedDev = 'Unassigned';
          }
        }

        batchData = {
          ...batchData,
          ...mapped,
          assignedDevice: assignedDev,
          _live: true
        };
      }
    } catch (_) {
      // Keep local cached record
    }

    // Determine latest telemetry reading
    const logs = batchData.readings || batchData.temperatureLogs || [];
    const latestReading = logs.length > 0 ? logs[logs.length - 1] : null;
    const latestTemp = latestReading ? (latestReading.temp ?? latestReading.temperature) : null;
    const latestHumidity = latestReading ? (latestReading.humidity) : null;
    const lastTimestamp = latestReading ? (latestReading.timestamp || latestReading.time) : null;

    // Freshness computation
    let freshnessStatus = 'No Telemetry Recorded';
    if (lastTimestamp) {
      const readingDate = new Date(lastTimestamp);
      const isRecent = !isNaN(readingDate.getTime()) && (Date.now() - readingDate.getTime() < 5 * 60 * 1000);
      freshnessStatus = isRecent ? 'Streaming Live' : 'Device Offline';
    }

    // Excursion status
    const minSafe = batchData.minTemp ?? batchData.requiredTempMin ?? SAFE_MIN;
    const maxSafe = batchData.maxTemp ?? batchData.requiredTempMax ?? SAFE_MAX;
    const hasExcursion = batchData.excursionAlert || (latestTemp !== null && (latestTemp < minSafe || latestTemp > maxSafe));

    // Assignment status
    const assignedDev = batchData.assignedDevice;
    let assignmentStatus = 'Unassigned';
    if (assignedDev && assignedDev !== 'Unassigned') {
      if (batchData.status === 'Delivered' || batchData.rawStatus === 'Delivered') {
        assignmentStatus = 'Shipment Completed';
      } else if (freshnessStatus === 'Streaming Live') {
        assignmentStatus = 'Monitoring';
      } else {
        assignmentStatus = 'Assigned';
      }
    }

    result.push({
      ...batchData,
      id: batchData.id || id,
      batchId: batchData.batchId || id,
      assignedDevice: assignedDev || 'Unassigned',
      latestTemperature: latestTemp,
      latestHumidity: latestHumidity,
      lastReadingTimestamp: lastTimestamp,
      freshnessStatus,
      assignmentStatus,
      coldChainStatus: hasExcursion ? 'Critical Excursion' : 'Normal',
      minSafe,
      maxSafe
    });
  }

  return res.json({ success: true, count: result.length, data: result });
});

// ---------------------------------------------------------------------------
// GET /api/devices & /api/fabric/devices – Query registered hardware devices & assignment state
// ---------------------------------------------------------------------------
app.get(['/api/devices', '/api/fabric/devices'], async (req, res) => {
  const devices = Array.from(knownDevices.values());
  return res.json({ success: true, count: devices.length, data: devices });
});

// ---------------------------------------------------------------------------
// POST /api/batch/create & /api/fabric/batch/create – Register a new batch on Hyperledger Fabric
// ---------------------------------------------------------------------------
app.post(['/api/batch/create', '/api/fabric/batch/create'], async (req, res) => {
  const { id, drugName, manufacturer, minTemp, maxTemp, mfgDate, expDate, quantity } = req.body;

  if (!id || !drugName || !manufacturer) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: id, drugName, and manufacturer are required.'
    });
  }

  const numMin = (minTemp !== undefined && !isNaN(Number(minTemp))) ? Number(minTemp) : SAFE_MIN;
  const numMax = (maxTemp !== undefined && !isNaN(Number(maxTemp))) ? Number(maxTemp) : SAFE_MAX;

  if (numMin >= numMax) {
    return res.status(400).json({
      success: false,
      error: 'Invalid temperature thresholds: minTemp must be strictly less than maxTemp.'
    });
  }

  const payload = {
    id: String(id).trim(),
    drugName: String(drugName).trim(),
    manufacturer: String(manufacturer).trim(),
    minTemp: numMin,
    maxTemp: numMax,
    mfgDate: mfgDate || new Date().toISOString().split('T')[0],
    expDate: expDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
    ...(quantity && { quantity: Number(quantity) })
  };

  try {
    const upstream = await fetch(`${SWAGATA_BASE}/api/batch/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: json.error || json.message || `Blockchain error (${upstream.status}) creating batch.`
      });
    }

    // Persist in local active batch registry
    registerTrackedBatch(payload.id, {
      ...payload,
      currentOwner: payload.manufacturer,
      status: 'Manufactured',
      assignedDevice: 'Unassigned',
      temperatureLogs: []
    });

    return res.status(201).json({
      success: true,
      message: `Batch '${payload.id}' successfully committed to Hyperledger Fabric.`,
      txId: json.txId || json.transactionId || 'tx_' + Math.random().toString(36).substring(2, 15),
      data: payload
    });

  } catch (err) {
    console.warn('[FABRIC PROXY] Error reaching Swagata create batch endpoint:', err.message);

    // Record in local fallback registry when ledger is temporarily unreachable
    const fallbackTx = 'f' + Array.from({ length: 63 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    registerTrackedBatch(payload.id, {
      ...payload,
      currentOwner: payload.manufacturer,
      status: 'Manufactured',
      assignedDevice: 'Unassigned',
      temperatureLogs: [],
      _mock: true
    });

    return res.status(201).json({
      success: true,
      message: `Batch '${payload.id}' registered (Fallback mode: Fabric gateway unreachable).`,
      txId: fallbackTx,
      data: payload,
      _fallback: true
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/device/assign & /api/fabric/device/assign – Assign a sensor box to a medicine batch
// ---------------------------------------------------------------------------
app.post(['/api/device/assign', '/api/fabric/device/assign'], async (req, res) => {
  const { deviceId, batchId } = req.body;

  if (!deviceId || !batchId) {
    return res.status(400).json({
      success: false,
      error: 'Both deviceId and batchId are required.'
    });
  }

  try {
    const upstream = await fetch(`${SWAGATA_BASE}/api/device/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, batchId })
    });

    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      let errorMsg = json.error || json.message || `Failed to assign device on blockchain.`;
      if (typeof errorMsg === 'string' && (errorMsg.includes('10 ABORTED') || errorMsg.includes('failed to endorse'))) {
        errorMsg = `Blockchain block commit in progress for this device. Please wait 2 seconds and retry.`;
      }
      return res.status(upstream.status).json({
        success: false,
        error: errorMsg
      });
    }

    updateDeviceAssignment(deviceId, batchId);

    return res.json({
      success: true,
      message: `Device '${deviceId}' successfully assigned to '${batchId}' on Hyperledger Fabric.`,
      txId: json.txId || 'tx_' + Math.random().toString(36).substring(2, 15),
      data: { deviceId, batchId }
    });

  } catch (err) {
    console.warn('[FABRIC PROXY] Error reaching Swagata assign endpoint:', err.message);
    updateDeviceAssignment(deviceId, batchId);

    return res.json({
      success: true,
      message: `Device '${deviceId}' assigned to '${batchId}' (Fallback mode).`,
      txId: 'f' + Array.from({ length: 63 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      data: { deviceId, batchId },
      _fallback: true
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/device/unassign & /api/fabric/device/unassign – Unassign a sensor box
// ---------------------------------------------------------------------------
app.post(['/api/device/unassign', '/api/fabric/device/unassign'], async (req, res) => {
  const { deviceId, batchId } = req.body;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: 'deviceId is required.'
    });
  }

  // Find target batch to unlink
  let targetBatchId = batchId;
  if (!targetBatchId) {
    for (const [bId, bRecord] of trackedBatches.entries()) {
      if (bRecord.assignedDevice === deviceId) {
        targetBatchId = bId;
        break;
      }
    }
  }

  try {
    // 1. Unassign device record on Fabric blockchain
    const upstream = await fetch(`${SWAGATA_BASE}/api/device/unassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    });

    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: json.error || json.message || `Failed to unassign device on blockchain.`
      });
    }

    // 2. Unlink batch on Fabric blockchain so batch.assignedDevice commits as 'Unassigned'
    if (targetBatchId) {
      await fetch(`${SWAGATA_BASE}/api/device/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'Unassigned', batchId: targetBatchId })
      }).catch((err) => {
        console.warn('[FABRIC PROXY] Batch device clearing on Fabric error:', err.message);
      });
    }

    // 3. Update gateway local caches immediately
    updateDeviceAssignment(deviceId, null);
    if (targetBatchId && trackedBatches.has(targetBatchId)) {
      trackedBatches.get(targetBatchId).assignedDevice = 'Unassigned';
    }

    return res.json({
      success: true,
      message: `Device '${deviceId}' successfully detached from batch '${targetBatchId || 'unknown'}' on Hyperledger Fabric.`,
      txId: json.txId || 'tx_' + Math.random().toString(36).substring(2, 15),
      data: { deviceId, batchId: targetBatchId }
    });

  } catch (err) {
    console.warn('[FABRIC PROXY] Error reaching Swagata unassign endpoint:', err.message);
    updateDeviceAssignment(deviceId, null);
    if (targetBatchId && trackedBatches.has(targetBatchId)) {
      trackedBatches.get(targetBatchId).assignedDevice = 'Unassigned';
    }

    return res.json({
      success: true,
      message: `Device '${deviceId}' unassigned (Fallback mode).`,
      txId: 'f' + Array.from({ length: 63 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      data: { deviceId, batchId: targetBatchId },
      _fallback: true
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/batch/transfer & /api/fabric/batch/transfer – Custody handoff on ledger
// ---------------------------------------------------------------------------
app.post(['/api/batch/transfer', '/api/fabric/batch/transfer'], async (req, res) => {
  const { id, newOwner, newStatus } = req.body;

  if (!id || !newOwner || !newStatus) {
    return res.status(400).json({
      success: false,
      error: 'id, newOwner, and newStatus are required.'
    });
  }

  try {
    const upstream = await fetch(`${SWAGATA_BASE}/api/batch/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, newOwner, newStatus })
    });

    const json = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        success: false,
        error: json.error || json.message || `Failed to transfer batch on blockchain.`
      });
    }

    if (trackedBatches.has(id)) {
      const b = trackedBatches.get(id);
      b.currentOwner = newOwner;
      b.status = newStatus;
    }

    return res.json({
      success: true,
      message: `Batch '${id}' custody transferred to '${newOwner}' with status '${newStatus}'.`,
      txId: json.txId,
      data: { id, newOwner, newStatus }
    });

  } catch (err) {
    if (trackedBatches.has(id)) {
      const b = trackedBatches.get(id);
      b.currentOwner = newOwner;
      b.status = newStatus;
    }
    return res.json({
      success: true,
      message: `Batch '${id}' custody transferred to '${newOwner}' (Fallback mode).`,
      txId: 'f' + Array.from({ length: 63 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      data: { id, newOwner, newStatus },
      _fallback: true
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/batch/:id & /api/fabric/batch/:id – Proxy to Swagata's Hyperledger Fabric node
// ---------------------------------------------------------------------------
app.get(['/api/batch/:id', '/api/fabric/batch/:id'], validateBatchId, async (req, res) => {
  const { id } = req.params;

  try {
    const response = await fetch(`${SWAGATA_BASE}/api/batch/${id}`);

    if (!response.ok) {
      // Check if we have it in our tracked batches
      if (trackedBatches.has(id)) {
        const local = trackedBatches.get(id);
        const verifyUrl = `${FRONTEND_URL}/verify/${local.id}`;
        const qrCode = await QRCode.toDataURL(verifyUrl).catch(() => null);
        return res.json({ success: true, data: local, qrCode, _cached: true });
      }

      // Swagata's backend returns 500 for "batch not found" – normalise to clean 404
      const errBody = await response.json().catch(() => ({}));
      const isNotFound = response.status === 404 ||
        (errBody.error && String(errBody.error).includes('does not exist'));
      const status = isNotFound ? 404 : response.status;
      return res.status(status).json({
        success: false,
        error: isNotFound
          ? `Batch '${id}' does not exist on blockchain.`
          : (errBody.error || `Batch "${id}" not found on ledger.`)
      });
    }

    const json = await response.json();
    const mapped = mapSwagataBatch(json.data);

    // Keep tracked batches updated with live data
    if (trackedBatches.has(id)) {
      trackedBatches.set(id, { ...trackedBatches.get(id), ...mapped });
    }

    // Generate QR code pointing to the verify page
    const verifyUrl = `${FRONTEND_URL}/verify/${mapped.batchId}`;
    const qrCode = await QRCode.toDataURL(verifyUrl).catch(() => null);

    return res.json({ success: true, data: mapped, qrCode });

  } catch (err) {
    console.warn(`[FABRIC PROXY] Ledger unreachable for batch "${id}":`, err.message);

    // Check trackedBatches first
    if (trackedBatches.has(id)) {
      const local = trackedBatches.get(id);
      const verifyUrl = `${FRONTEND_URL}/verify/${local.id}`;
      const qrCode = await QRCode.toDataURL(verifyUrl).catch(() => null);
      return res.json({
        success: true,
        data: local,
        qrCode,
        _mock: true,
        warning: 'Using registered cached data – ledger is currently unreachable.'
      });
    }

    // Try to find a matching mock batch (helpful during demos when ledger is offline)
    const mockKey = Object.keys(mockTelemetryDatasets).find(
      (k) => mockTelemetryDatasets[k].batchId.toLowerCase() === id.toLowerCase()
    );
    if (!mockKey) {
      return res.status(404).json({
        success: false,
        error: `Batch '${id}' does not exist on blockchain.`
      });
    }

    const fallbackData = mockTelemetryDatasets[mockKey];
    const verifyUrl = `${FRONTEND_URL}/verify/${fallbackData.batchId}`;
    const qrCode = await QRCode.toDataURL(verifyUrl).catch(() => null);

    return res.json({
      success: true,
      data: fallbackData,
      qrCode,
      _mock: true,
      warning: 'Using mock data – ledger is currently unreachable.'
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/batch/:id/history & /api/fabric/batch/:id/history – Ledger audit history
// ---------------------------------------------------------------------------
app.get(['/api/batch/:id/history', '/api/fabric/batch/:id/history'], validateBatchId, async (req, res) => {
  const { id } = req.params;
  const page = req.query.page || 1;
  const pageSize = req.query.pageSize || req.query.limit || 50;

  try {
    const response = await fetch(`${SWAGATA_BASE}/api/batch/${id}/history?page=${page}&pageSize=${pageSize}`);
    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        success: false,
        error: errBody.error || `Could not retrieve history for batch "${id}".`
      });
    }
    const json = await response.json();
    return res.json(json);
  } catch (err) {
    console.warn(`[FABRIC PROXY] Ledger history unreachable for batch "${id}":`, err.message);
    const batchRecord = trackedBatches.get(id);
    return res.json({
      success: true,
      data: [
        {
          txId: "561390cbaa6464f690a47cc3b5656a235f3be17ebab696b8c4e1472b05637cc0",
          timestamp: new Date().toISOString(),
          isDelete: false,
          record: {
            id,
            batchId: id,
            drugName: batchRecord?.drugName || "Covishield Vaccine",
            manufacturer: batchRecord?.manufacturer || "Serum Institute of India",
            currentOwner: batchRecord?.currentOwner || "Manufacturer",
            status: batchRecord?.status || "IN_TRANSIT",
            minTemp: batchRecord?.minTemp || 2.0,
            maxTemp: batchRecord?.maxTemp || 8.0,
            excursionAlert: !!batchRecord?.excursionAlert,
            assignedDevice: batchRecord?.assignedDevice || "ESP32_BOX_01",
            deviceId: batchRecord?.deviceId || "ESP32_BOX_01"
          }
        }
      ],
      pagination: {
        totalRecords: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
        hasMore: false
      },
      _mock: true
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/device/:deviceId/batch & /api/fabric/device/:deviceId/batch – Device-to-batch mapping
// ---------------------------------------------------------------------------
app.get(['/api/device/:deviceId/batch', '/api/fabric/device/:deviceId/batch'], async (req, res) => {
  const { deviceId } = req.params;
  try {
    const response = await fetch(`${SWAGATA_BASE}/api/device/${encodeURIComponent(deviceId)}/batch`);
    const json = await response.json();
    return res.status(response.status).json(json);
  } catch (err) {
    console.warn(`[FABRIC PROXY] Device query unreachable for "${deviceId}":`, err.message);
    const dev = knownDevices.get(deviceId);
    if (dev) {
      return res.json({
        success: true,
        data: {
          deviceId: dev.deviceId,
          batchId: dev.assignedBatch,
          assignedBatch: dev.assignedBatch,
          active: !!dev.assignedBatch,
          status: dev.status
        },
        _fallback: true
      });
    }
    return res.json({
      success: true,
      data: null,
      _fallback: true
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/security/offchain/:cid & /api/fabric/security/offchain/:cid – Off-Chain / IPFS Storage Data
// ---------------------------------------------------------------------------
app.get(['/api/security/offchain/:cid', '/api/fabric/security/offchain/:cid'], async (req, res) => {
  const { cid } = req.params;
  try {
    const upstream = await fetch(`${SWAGATA_BASE}/api/security/offchain/${encodeURIComponent(cid)}`);
    const body = await upstream.text();
    let json;
    try {
      json = JSON.parse(body);
    } catch (_) {
      json = { success: upstream.ok, data: body };
    }
    return res.status(upstream.status).json(json);
  } catch (err) {
    console.warn(`[OFFCHAIN PROXY] Could not reach Fabric IPFS endpoint for CID ${cid}:`, err.message);
    return res.status(502).json({
      success: false,
      error: `Could not reach Fabric IPFS endpoint: ${err.message}`
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/iot/temperature – Record live sensor temperature telemetry to Fabric
// ---------------------------------------------------------------------------
app.post(['/api/iot/temperature', '/api/fabric/iot/temperature'], async (req, res) => {
  const payload = req.body;
  try {
    const upstream = await fetch(`${SWAGATA_BASE}/api/iot/temperature`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await upstream.json().catch(() => ({}));
    if (upstream.ok && payload.batchId && trackedBatches.has(payload.batchId)) {
      const b = trackedBatches.get(payload.batchId);
      b.temperatureLogs = b.temperatureLogs || [];
      b.temperatureLogs.push({
        timestamp: payload.timestamp || new Date().toISOString(),
        temperature: Number(payload.temperature),
        humidity: Number(payload.humidity ?? 60),
        reporter: payload.reporter || payload.deviceId || 'ESP32_BOX_01'
      });
    }
    return res.status(upstream.status).json(json);
  } catch (err) {
    console.warn('[IOT PROXY] Error posting temperature to Fabric:', err.message);
    if (payload.batchId && trackedBatches.has(payload.batchId)) {
      const b = trackedBatches.get(payload.batchId);
      b.temperatureLogs = b.temperatureLogs || [];
      b.temperatureLogs.push({
        timestamp: payload.timestamp || new Date().toISOString(),
        temperature: Number(payload.temperature),
        humidity: Number(payload.humidity ?? 60),
        reporter: payload.reporter || payload.deviceId || 'ESP32_BOX_01'
      });
    }
    return res.json({
      success: true,
      message: `Telemetry recorded in local proxy buffer (Fabric temporarily offline).`,
      receivedData: payload,
      _fallback: true
    });
  }
});

// ---------------------------------------------------------------------------
// Existing mock routes – kept for backward-compat
// ---------------------------------------------------------------------------
app.get('/api/batches/mock', (req, res) => {
  res.json({ success: true, data: mockTelemetryDatasets, _mock: true });
});

app.get('/api/batches/:batchId', validateBatchId, (req, res) => {
  const { batchId } = req.params;
  const batchKey = Object.keys(mockTelemetryDatasets).find(
    (k) => mockTelemetryDatasets[k].batchId.toLowerCase() === batchId.toLowerCase()
  );
  if (!batchKey) {
    return res.status(404).json({ success: false, error: 'Batch not found' });
  }
  res.json({ success: true, data: mockTelemetryDatasets[batchKey], _mock: true });
});

// ---------------------------------------------------------------------------
// FIXED  POST /api/batches/:batchId/anomaly  – proxy to Flask ML service
//        Fixes:
//          1. Port corrected from 5000 → 5001
//          2. Fallback uses correct field `temperature` (not `thermal_shipper_temp_reading`)
//          3. Accepts new 3-field payload: { temperature, humidity, sensor_id, timestamp }
// ---------------------------------------------------------------------------
app.post('/api/batches/:batchId/anomaly', validateBatchId, async (req, res) => {
  const { temperature, humidity, sensor_id, timestamp } = req.body;

  // Build the payload the ML service expects (timestamp is optional but preferred)
  const mlPayload = {
    temperature,
    humidity: humidity ?? MEAN_HUMIDITY,  // default to training mean if not provided
    sensor_id: sensor_id || req.params.batchId,
    ...(timestamp && { timestamp }), // forward ISO timestamp for hour_of_day extraction
  };

  try {
    const mlResponse = await fetch(`${ML_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mlPayload)
    });

    if (!mlResponse.ok) {
      const errData = await mlResponse.json().catch(() => ({}));
      return res.status(mlResponse.status).json({ success: false, error: errData.error || 'ML service error' });
    }

    const data = await mlResponse.json();
    const batch = trackedBatches.get(req.params.batchId);
    const minSafe = batch?.minTemp ?? SAFE_MIN;
    const maxSafe = batch?.maxTemp ?? SAFE_MAX;
    const isExcursion = temperature < minSafe || temperature > maxSafe;

    return res.json({
      success: true,
      data: {
        ...data,
        is_anomaly: data.is_anomaly || isExcursion,
        is_excursion: isExcursion,
        anomaly_score: isExcursion && data.anomaly_score > 0 ? -0.15 : data.anomaly_score,
        prediction: (data.is_anomaly || isExcursion) ? -1 : 1
      }
    });

  } catch (err) {
    // Flask ML service unreachable – use threshold-based rule fallback
    console.warn('[ML PROXY] Flask ML service unreachable, using rule-based fallback:', err.message);
    const batch = trackedBatches.get(req.params.batchId);
    const minSafe = batch?.minTemp ?? SAFE_MIN;
    const maxSafe = batch?.maxTemp ?? SAFE_MAX;
    const isExcursion = temperature < minSafe || temperature > maxSafe;
    return res.json({
      success: true,
      data: {
        is_anomaly: isExcursion,
        is_excursion: isExcursion,
        anomaly_score: isExcursion ? -1.0 : 1.0,
        prediction: isExcursion ? -1 : 1,
        fallback_used: true
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Verify route – now delegates to the fabric proxy so QR pages always show
//               live data when available
// ---------------------------------------------------------------------------
app.get('/verify/:batchId', validateBatchId, async (req, res) => {
  const { batchId } = req.params;

  try {
    const fabricResponse = await fetch(`${SWAGATA_BASE}/api/batch/${batchId}`);
    if (fabricResponse.ok) {
      const json = await fabricResponse.json();
      const mapped = mapSwagataBatch(json.data);
      const verifyUrl = `${FRONTEND_URL}/verify/${mapped.batchId}`;
      const qrCode = await QRCode.toDataURL(verifyUrl).catch(() => null);
      return res.json({ success: true, data: mapped, qrCode });
    }
  } catch (_) {
    // fall through to mock
  }

  // Mock fallback
  const batchKey = Object.keys(mockTelemetryDatasets).find(
    (k) => mockTelemetryDatasets[k].batchId.toLowerCase() === batchId.toLowerCase()
  );
  if (!batchKey) {
    return res.status(404).json({ success: false, error: 'Batch not found' });
  }
  const verifyUrl = `${FRONTEND_URL}/verify/${mockTelemetryDatasets[batchKey].batchId}`;
  const qrCode = await QRCode.toDataURL(verifyUrl).catch(() => null);
  return res.json({
    success: true,
    data: mockTelemetryDatasets[batchKey],
    qrCode,
    _mock: true,
    warning: 'Using mock data – ledger is currently unreachable.'
  });
});

app.listen(PORT, () => {
    console.log(`ColdChainRx Express API running on http://localhost:${PORT}`);
    console.log(`  Fabric proxy: ${SWAGATA_BASE}  →  GET /api/fabric/batch/:id`);
    console.log(`  ML service:   ${ML_BASE}/predict`);
});
