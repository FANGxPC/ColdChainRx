const express = require('express');
const QRCode = require('qrcode');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

const app = express();

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
function validateBatchId(req, res, next) {
    const { batchId } = req.params;
    // Regex: Only alphanumeric and hyphens, max 30 chars
    const batchIdRegex = /^[A-Za-z0-9\-]{3,30}$/;
    
    if (!batchIdRegex.test(batchId)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid Batch ID format. Must be alphanumeric and hyphens only, up to 30 characters.' 
        });
    }
    next();
}

const PORT = 3001;

// Mock database (will be replaced by Fabric Gateway SDK queries)
const mockTelemetryDatasets = {
  standard: {
    batchId: "BATCH-V2026-001",
    drugName: "COVID-19 MRNA Vaccine (Standard Cold)",
    manufacturer: "PharmaCorp Global",
    mfgDate: "2026-08-15",
    expiryDate: "2027-08-15",
    requiredTempMin: 2,
    requiredTempMax: 8,
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
    requiredTempMin: 2,
    requiredTempMax: 8,
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

// Return mock batch list
app.get('/api/batches', (req, res) => {
  res.json({ success: true, data: mockTelemetryDatasets });
});

// Return full batch detail + history
app.get('/api/batches/:batchId', validateBatchId, (req, res) => {
  const { batchId } = req.params;
  const batchKey = Object.keys(mockTelemetryDatasets).find(
    k => mockTelemetryDatasets[k].batchId.toLowerCase() === batchId.toLowerCase()
  );

  if (!batchKey) {
    return res.status(404).json({ success: false, error: "Batch not found" });
  }

  res.json({ success: true, data: mockTelemetryDatasets[batchKey] });
});

// Proxies to Flask ML inference endpoint
app.post('/api/batches/:batchId/anomaly', validateBatchId, async (req, res) => {
  const features = req.body; 
  
  try {
    const response = await fetch('http://localhost:5000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ success: false, error: errData.error || 'ML Service error' });
    }

    const data = await response.json();
    res.json({ success: true, data });
  } catch (err) {
    console.error("ML Service down, using fallback:", err.message);
    const temp = features.thermal_shipper_temp_reading;
    const isExcursion = temp < 2 || temp > 8; 
    
    res.json({
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

// Verify route -> returns verification result + QR code
app.get('/verify/:batchId', validateBatchId, async (req, res) => {
  const { batchId } = req.params;
  
  const batchKey = Object.keys(mockTelemetryDatasets).find(
    k => mockTelemetryDatasets[k].batchId.toLowerCase() === batchId.toLowerCase()
  );

  if (!batchKey) {
    return res.status(404).json({ success: false, error: 'Batch not found' });
  }

  try {
    const verificationUrl = `http://localhost:3000/verify/${mockTelemetryDatasets[batchKey].batchId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl);

    res.json({
      success: true,
      data: mockTelemetryDatasets[batchKey],
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate QR code' });
  }
});

app.listen(PORT, () => {
    console.log(`Express API running on http://localhost:${PORT}`);
});
