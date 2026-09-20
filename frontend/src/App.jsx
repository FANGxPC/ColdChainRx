import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  QrCode,
  Search,
  CheckCircle2,
  Cpu,
  Database,
  ThermometerSnowflake,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import TempHistoryChart from './components/TempHistoryChart';
import { mockTelemetryDatasets } from './data/mockTelemetryData';
import './App.css';

export default function App() {
  const [selectedDatasetKey, setSelectedDatasetKey] = useState('standard');
  const [searchBatchId, setSearchBatchId] = useState('');
  const [activeTab, setActiveTab] = useState('verification');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const currentDataset = mockTelemetryDatasets[selectedDatasetKey] || mockTelemetryDatasets.standard;

  // Simulate fetching dynamic QR code from Express Backend or local generator
  useEffect(() => {
    async function fetchQrCode() {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:3000/verify/${currentDataset.batchId}`);
        if (response.ok) {
          const resData = await response.json();
          if (resData.qrCode) {
            setQrCodeUrl(resData.qrCode);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Fallback placeholder QR using quickchart.io or static canvas URL if backend server is offline
      }
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
        `http://localhost:5173/verify/${currentDataset.batchId}`
      )}`);
      setLoading(false);
    }

    fetchQrCode();
  }, [currentDataset.batchId]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchBatchId.trim()) return;

    // Check if entered batch ID matches any mock dataset key or ID
    const foundKey = Object.keys(mockTelemetryDatasets).find(
      (key) =>
        key.toLowerCase() === searchBatchId.toLowerCase() ||
        mockTelemetryDatasets[key].batchId.toLowerCase() === searchBatchId.toLowerCase()
    );

    if (foundKey) {
      setSelectedDatasetKey(foundKey);
    } else {
      alert(`Batch "${searchBatchId}" not found in local mock network. Showing default batch.`);
    }
  };

  const isExcursion = currentDataset.status.includes('Breach') || currentDataset.status.includes('Warning');

  return (
    <div className="portal-app">
      {/* Top Header Navbar */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="brand-logo">
            <ThermometerSnowflake className="brand-icon" />
          </div>
          <div>
            <h1 className="brand-title">ColdChainRx</h1>
            <p className="brand-subtitle">Hyperledger Fabric & ML Cold-Chain Integrity Platform</p>
          </div>
        </div>

        <nav className="nav-links">
          <button
            type="button"
            className={`nav-btn ${activeTab === 'verification' ? 'active' : ''}`}
            onClick={() => setActiveTab('verification')}
          >
            <ShieldCheck className="nav-btn-icon" /> Consumer QR Verification
          </button>
          <button
            type="button"
            className={`nav-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveTab('telemetry')}
          >
            <Cpu className="nav-btn-icon" /> ML Anomaly Telemetry
          </button>
        </nav>
      </header>

      {/* Main Container */}
      <main className="portal-main">
        {/* Dataset Quick Switcher Banner */}
        <section className="demo-selector-card">
          <div className="selector-title">
            <Sparkles className="sparkle-icon" />
            <span>Select Demo Vaccine Telemetry Scenario (Sadique Week 4 & 5 Preview):</span>
          </div>
          <div className="selector-buttons">
            <button
              type="button"
              className={`selector-btn ${selectedDatasetKey === 'standard' ? 'active' : ''}`}
              onClick={() => setSelectedDatasetKey('standard')}
            >
              ✅ Standard Cold Storage (2°C–8°C)
            </button>
            <button
              type="button"
              className={`selector-btn ${selectedDatasetKey === 'excursion' ? 'active' : ''}`}
              onClick={() => setSelectedDatasetKey('excursion')}
            >
              ⚠️ Thermal Excursion Spike
            </button>
            <button
              type="button"
              className={`selector-btn ${selectedDatasetKey === 'ultralow' ? 'active' : ''}`}
              onClick={() => setSelectedDatasetKey('ultralow')}
            >
              ❄️ Ultra-Low MRNA Vault (-80°C)
            </button>
          </div>
        </section>

        {/* Batch Lookup Search Bar */}
        <section className="search-section">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <div className="search-input-wrapper">
              <Search className="search-icon" />
              <input
                type="text"
                className="search-input"
                placeholder="Enter Vaccine Batch ID (e.g. BATCH-V2026-001, BATCH-V2026-EXC)..."
                value={searchBatchId}
                onChange={(e) => setSearchBatchId(e.target.value)}
              />
            </div>
            <button type="submit" className="search-submit-btn">
              Verify Batch
            </button>
          </form>
        </section>

        {/* Batch Information Grid */}
        <section className="batch-grid">
          {/* Status & QR Verification Card */}
          <div className={`batch-card status-card ${isExcursion ? 'card-excursion' : 'card-pass'}`}>
            <div className="card-badge-header">
              <span className={`status-pill ${isExcursion ? 'pill-excursion' : 'pill-pass'}`}>
                {isExcursion ? <AlertTriangle className="pill-icon" /> : <CheckCircle2 className="pill-icon" />}
                {currentDataset.status}
              </span>
              <span className="chain-badge">Hyperledger Fabric Verified</span>
            </div>

            <div className="qr-section">
              <div className="qr-wrapper">
                {loading ? (
                  <div className="qr-loading">Generating Dynamic QR...</div>
                ) : (
                  <img src={qrCodeUrl} alt="Batch QR Code" className="qr-image" />
                )}
              </div>
              <div className="qr-meta">
                <span className="qr-label"><QrCode className="qr-icon" /> Scan to Verify Authenticity</span>
                <code className="batch-id-code">{currentDataset.batchId}</code>
              </div>
            </div>

            <div className="drug-meta">
              <h2 className="drug-name">{currentDataset.drugName}</h2>
              <div className="meta-details">
                <p><strong>Manufacturer:</strong> {currentDataset.manufacturer}</p>
                <p><strong>Manufacture Date:</strong> {currentDataset.mfgDate}</p>
                <p><strong>Expiration Date:</strong> {currentDataset.expiryDate}</p>
                <p><strong>Storage Standard:</strong> {currentDataset.storageType}</p>
              </div>
            </div>
          </div>

          {/* System Provenance & Subsystem Ownership Card */}
          <div className="batch-card info-card">
            <h3 className="info-title">
              <Layers className="info-title-icon" /> Blockchain & Subsystem Traceability
            </h3>

            <div className="subsystem-pipeline">
              <div className="pipeline-step">
                <div className="step-number">1</div>
                <div>
                  <strong>IoT Telemetry (Omkar Lead)</strong>
                  <p>ESP32 / DHT22 sensor array publishing MQTT payloads every 60s.</p>
                </div>
              </div>

              <div className="pipeline-step">
                <div className="step-number">2</div>
                <div>
                  <strong>Fabric Chaincode (Swagata Lead)</strong>
                  <p>Smart contract records `TransferCustody` & `RecordTempReading` on ledger.</p>
                </div>
              </div>

              <div className="pipeline-step highlight-step">
                <div className="step-number">3</div>
                <div>
                  <strong>ML & QR Verification (Sadique Lead)</strong>
                  <p>Isolation Forest anomaly model + React QR Consumer Portal chart rendering.</p>
                </div>
              </div>
            </div>

            <div className="blockchain-hash-box">
              <div className="hash-header">
                <Database className="hash-icon" /> Ledger Block Commitment
              </div>
              <p className="hash-string">TxHash: 0x7f9a8b2c4d1e3f5a6b7c8d9e0f1a2b3c4d5e6f7a</p>
              <p className="channel-name">Channel: <code>pharmachannel</code> | Peer: <code>peer0.org1.pharmachain.com</code></p>
            </div>
          </div>
        </section>

        {/* Temperature History Chart Component (Sadique Week 4 Deliverable) */}
        <section className="chart-section">
          <TempHistoryChart batchData={currentDataset} isMockData={true} />
        </section>
      </main>

      {/* Footer */}
      <footer className="portal-footer">
        <p>ColdChainRx — Multi-Layer Pharmaceutical Cold Chain Verification Platform</p>
        <p className="footer-subtext">Developed by Swagata (Blockchain/Backend), Omkar (IoT/Security), and Sadique (ML/Frontend)</p>
      </footer>
    </div>
  );
}
