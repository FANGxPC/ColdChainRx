const express = require('express');
const QRCode = require('qrcode');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// ---------------------------------------------------------------------------
// Swagata's Fabric backend base URL
// Reads from env first (set FABRIC_BACKEND_URL in .env) so the IP never
// needs a code change when the host moves.
// Correct IP confirmed 2026-10-23: 10.194.253.204 (same 10.194.253.x subnet)
// ---------------------------------------------------------------------------
const SWAGATA_BASE = process.env.FABRIC_BACKEND_URL || 'http://localhost:5000';

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
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10kb' })); // Mitigate DoS by limiting payload size

// 3. Morgan: Request logging for audit trails
app.use(morgan('combined'));

// 4. Rate Limiting: Mitigate DoS and brute-force API scraping
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

const verifyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // Limit consumer verify endpoints to 20 requests per 5 mins
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

const PORT = 3001;

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
  }
};

// ---------------------------------------------------------------------------
// Helper: Convert Swagata's batch JSON → the shape the UI and chart expect
// ---------------------------------------------------------------------------
function mapSwagataBatch(raw) {
  const minTemp = raw.minTemp !== undefined ? raw.minTemp : SAFE_MIN;
  const maxTemp = raw.maxTemp !== undefined ? raw.maxTemp : SAFE_MAX;

  const readings = (raw.temperatureLogs || []).map((log) => {
    const temp = log.temperature;
    let readingStatus = 'NORMAL';
    if (temp > maxTemp) readingStatus = 'CRITICAL_EXCURSION';
    else if (temp >= maxTemp - 0.5) readingStatus = 'WARNING'; // within 0.5°C of ceiling
    else if (temp < minTemp) readingStatus = 'CRITICAL_EXCURSION';

    return {
      time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp,
      humidity: (log.humidity !== undefined && log.humidity !== null && log.humidity > 0) ? log.humidity : MEAN_HUMIDITY,
      location: log.reporter || 'Unknown Sensor',
      hop: 'Ledger recorded',
      status: readingStatus,
      // Pass raw timestamp so the ML service can extract hour_of_day correctly
      timestamp: log.timestamp,
    };
  });

  const hasExcursion = raw.excursionAlert || readings.some((r) => r.status === 'CRITICAL_EXCURSION');

  return {
    batchId: raw.id,
    drugName: raw.drugName || 'Unknown Drug',
    manufacturer: raw.manufacturer || 'Unknown Manufacturer',
    currentOwner: raw.currentOwner || 'Unknown',
    mfgDate: null,          // not provided by ledger
    expiryDate: null,       // not provided by ledger
    requiredTempMin: minTemp,
    requiredTempMax: maxTemp,
    unit: '°C',
    status: hasExcursion ? 'Temperature Breach Detected' : `Authentic & Safe (${raw.status || 'InTransit'})`,
    storageType: `Cold Storage (${minTemp}°C – ${maxTemp}°C)`,
    excursionAlert: hasExcursion,
    assignedDevice: raw.assignedDevice || null,
    readings,
    _live: true,  // flag to distinguish from mock data
  };
}

// ---------------------------------------------------------------------------
// NEW  GET /api/fabric/batch/:id  – Proxy to Swagata's Hyperledger Fabric node
//      This is the recommended single source of truth for the UI.
// ---------------------------------------------------------------------------
app.get('/api/fabric/batch/:id', validateBatchId, async (req, res) => {
  const { id } = req.params;

  try {
    const response = await fetch(`${SWAGATA_BASE}/api/batch/${id}`);

    if (!response.ok) {
      // Swagata's backend returns 500 for "batch not found" – normalise to 404
      const errBody = await response.json().catch(() => ({}));
      const status = response.status === 500 ? 404 : response.status;
      return res.status(status).json({
        success: false,
        error: errBody.error || `Batch "${id}" not found on ledger.`
      });
    }

    const json = await response.json();
    const mapped = mapSwagataBatch(json.data);

    // Generate QR code pointing to the verify page
    const verifyUrl = `http://localhost:3000/verify/${mapped.batchId}`;
    const qrCode = await QRCode.toDataURL(verifyUrl).catch(() => null);

    return res.json({ success: true, data: mapped, qrCode });

  } catch (err) {
    // Network error – Fabric node unreachable → fallback to mock
    console.warn(`[FABRIC PROXY] Ledger unreachable for batch "${id}":`, err.message);

    // Try to find a matching mock batch (helpful during demos when ledger is offline)
    const mockKey = Object.keys(mockTelemetryDatasets).find(
      (k) => mockTelemetryDatasets[k].batchId.toLowerCase() === id.toLowerCase()
    );
    const fallbackData = mockKey
      ? mockTelemetryDatasets[mockKey]
      : mockTelemetryDatasets.standard;

    const verifyUrl = `http://localhost:3000/verify/${fallbackData.batchId}`;
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
// NEW  Proxy routes for Batch Creation and Device Assignment
// ---------------------------------------------------------------------------
app.post('/api/fabric/batch/create', async (req, res) => {
  try {
    const response = await fetch(`${SWAGATA_BASE}/api/batch/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ success: false, error: `Fabric backend unreachable: ${err.message}` });
  }
});

app.post('/api/fabric/device/assign', async (req, res) => {
  try {
    const response = await fetch(`${SWAGATA_BASE}/api/device/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ success: false, error: `Fabric backend unreachable: ${err.message}` });
  }
});

app.get('/api/fabric/device/:id/batch', async (req, res) => {
  try {
    const response = await fetch(`${SWAGATA_BASE}/api/device/${encodeURIComponent(req.params.id)}/batch`);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(502).json({ success: false, error: `Fabric backend unreachable: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// Existing mock routes – kept for backward-compat, but mark as deprecated
// ---------------------------------------------------------------------------
app.get('/api/batches', (req, res) => {
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
    const mlResponse = await fetch('http://localhost:5001/predict', { // ← port 5001
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mlPayload)
    });

    if (!mlResponse.ok) {
      const errData = await mlResponse.json().catch(() => ({}));
      return res.status(mlResponse.status).json({ success: false, error: errData.error || 'ML service error' });
    }

    const data = await mlResponse.json();
    return res.json({ success: true, data });

  } catch (err) {
    // Flask ML service unreachable – use threshold-based rule fallback
    console.warn('[ML PROXY] Flask ML service unreachable, using rule-based fallback:', err.message);
    const isExcursion = temperature < SAFE_MIN || temperature > SAFE_MAX;
    return res.json({
      success: true,
      data: {
        is_anomaly: isExcursion,
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
      const verifyUrl = `http://localhost:3000/verify/${mapped.batchId}`;
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
  const verifyUrl = `http://localhost:3000/verify/${mockTelemetryDatasets[batchKey].batchId}`;
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
    console.log(`  ML service:   http://localhost:5001/predict`);
});
