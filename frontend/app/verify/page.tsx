"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from "next/link";
import { Snowflake, MapPin, Thermometer, ArrowLeft, Search, Sparkles, QrCode, AlertTriangle, Wifi, WifiOff } from "lucide-react";
import { mockTelemetryDatasets } from "@/lib/data/mockTelemetryData";
import { StatusBadge } from "@/components/verify/status-badge";
import { DrugDetails } from "@/components/verify/drug-details";
import { BlockchainCard } from "@/components/verify/blockchain-card";
import TempHistoryChart from "@/components/TempHistoryChart";
import { MlBadge } from "@/components/verify/ml-badge";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API_BASE = "http://localhost:3001";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type MlResult = {
  is_anomaly: boolean;
  anomaly_score: number;
  prediction: number;
  fallback_used?: boolean;
};

// ---------------------------------------------------------------------------
// Helper: call anomaly endpoint for the last reading of a batch
// ---------------------------------------------------------------------------
async function fetchMlPrediction(
  batchId: string,
  temperature: number,
  humidity: number,
  timestamp?: string
): Promise<MlResult | null> {
  try {
    const res = await fetch(`${API_BASE}/api/batches/${batchId}/anomaly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ temperature, humidity, sensor_id: batchId, timestamp }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function VerifyPage() {
  // --- UI state ---
  const [selectedDatasetKey, setSelectedDatasetKey] = useState("standard");
  const [searchBatchId, setSearchBatchId] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // --- Data state ---
  const [liveData, setLiveData] = useState<any>(null);   // live batch from blockchain
  const [isMock, setIsMock] = useState(false);           // true when blockchain unreachable
  const [mlResult, setMlResult] = useState<MlResult | null>(null);
  const [mlLoading, setMlLoading] = useState(false);

  // Suppress hydration mismatch
  useEffect(() => setMounted(true), []);

  // The mock fallback dataset (for demo scenario buttons)
  const localDataset = (mockTelemetryDatasets as any)[selectedDatasetKey] || mockTelemetryDatasets.standard;

  // What we actually display: live data if available, otherwise the selected mock
  const currentDataset = liveData || localDataset;

  // ---------------------------------------------------------------------------
  // Fetch from the new /api/fabric/batch/:id proxy (Option B – recommended)
  // ---------------------------------------------------------------------------
  const fetchBatch = useCallback(async (batchId: string) => {
    if (!mounted) return;
    setLoading(true);
    setLiveData(null);
    setMlResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/fabric/batch/${encodeURIComponent(batchId)}`);
      const json = await res.json();

      if (json.success) {
        setLiveData(json.data);
        setIsMock(!!json._mock);
        if (json.qrCode) setQrCodeUrl(json.qrCode);

        // After fetching the batch, run ML on the latest reading
        const readings = json.data?.readings;
        if (readings && readings.length > 0) {
          const latest = readings[readings.length - 1];
          setMlLoading(true);
          const ml = await fetchMlPrediction(
            json.data.batchId,
            latest.temp,
            latest.humidity,
            latest.timestamp   // ISO timestamp forwarded for hour_of_day
          );
          setMlResult(ml);
          setMlLoading(false);
        }
      } else {
        // Batch not found on ledger – show a meaningful error but stay on page
        console.warn("Batch not found on ledger:", json.error);
        setLiveData(null);
        setIsMock(false);
        // Generate a QR code for the searched ID anyway (for demos)
        const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
          `${API_BASE}/verify/${batchId}`
        )}`;
        setQrCodeUrl(qr);
      }
    } catch (err) {
      // Express backend itself is down (not just the ledger)
      console.warn("Express backend unreachable, using local mock:", err);
      setLiveData(null);
      setIsMock(true);
      const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
        `http://localhost:3000/verify/${batchId}`
      )}`;
      setQrCodeUrl(qr);
    } finally {
      setLoading(false);
    }
  }, [mounted]);

  // Fetch whenever the current batch ID changes (either via demo buttons or search)
  useEffect(() => {
    fetchBatch(localDataset.batchId);
  }, [localDataset.batchId, fetchBatch]);

  // ---------------------------------------------------------------------------
  // Search handler – queries real blockchain first, falls back to mock
  // ---------------------------------------------------------------------------
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = searchBatchId.trim();
    if (!input) return;

    const batchIdRegex = /^[A-Za-z0-9_\-]{3,50}$/;
    if (!batchIdRegex.test(input)) {
      alert("Invalid format: Batch ID must be alphanumeric (hyphens/underscores OK), 3–50 characters.");
      return;
    }

    // Try the blockchain first
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/fabric/batch/${encodeURIComponent(input)}`);
      const json = await res.json();

      if (json.success && !json._mock) {
        // Real live batch found on ledger
        setLiveData(json.data);
        setIsMock(false);
        if (json.qrCode) setQrCodeUrl(json.qrCode);

        const readings = json.data?.readings;
        if (readings && readings.length > 0) {
          const latest = readings[readings.length - 1];
          setMlLoading(true);
          const ml = await fetchMlPrediction(
            json.data.batchId,
            latest.temp,
            latest.humidity,
            latest.timestamp
          );
          setMlResult(ml);
          setMlLoading(false);
        }
        setLoading(false);
        return;
      }
    } catch {
      // ignore, fall through
    }

    // Not on ledger – check mock datasets
    const foundKey = Object.keys(mockTelemetryDatasets).find(
      (key) =>
        key.toLowerCase() === input.toLowerCase() ||
        (mockTelemetryDatasets as any)[key].batchId.toLowerCase() === input.toLowerCase()
    );

    if (foundKey) {
      setSelectedDatasetKey(foundKey);
      setLiveData(null); // will re-fetch via useEffect
    } else {
      alert(`Batch "${input}" was not found on the Fabric ledger or in demo batches.`);
    }
    setLoading(false);
  };

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------
  const isExcursion =
    currentDataset.excursionAlert ||
    currentDataset.status?.includes("Breach") ||
    currentDataset.status?.includes("Warning");

  const lastReading = currentDataset.readings?.[currentDataset.readings.length - 1];

  const mappedBatch = {
    id: currentDataset.batchId,
    status: isExcursion ? "compromised" : "authentic",
    drug: currentDataset.drugName,
    manufacturer: currentDataset.manufacturer,
    mfgDate: currentDataset.mfgDate || "—",
    expiry: currentDataset.expiryDate || "—",
    location: lastReading?.location || currentDataset.currentOwner || "Unknown",
    liveTemp: lastReading?.temp ?? 0,
    txHash: "0x7f9a8b2c4d1e3f5a6b7c8d9e0f1a2b3c4d5e6f7a",
    verifiedAt: new Date().toISOString(),
    blockHeight: 124045,
    // Use live ML result if available, otherwise fall back to count-based heuristic
    anomalies: mlResult
      ? (mlResult.is_anomaly ? 1 : 0)
      : (isExcursion
          ? currentDataset.readings?.filter(
              (r: any) => r.status === "CRITICAL_EXCURSION" || r.status === "WARNING"
            ).length ?? 0
          : 0),
    node: "peer0.org1.pharmachain.com",
  };

  if (!mounted) return null;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 clinical-grid opacity-60" aria-hidden />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4 pb-10 pt-6">
        <header className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Home</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Snowflake className="size-4" aria-hidden />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              ColdChain<span className="text-primary">Rx</span>
            </span>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        {/* Demo-mode / ledger-status banner                                    */}
        {/* ------------------------------------------------------------------ */}
        {isMock && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-600 dark:text-yellow-400">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            <span>
              <strong>Demo mode</strong> – Fabric ledger is currently unreachable. Displaying mock data.
            </span>
          </div>
        )}
        {liveData && !isMock && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-safe/40 bg-safe/10 px-4 py-2.5 text-sm text-safe">
            <Wifi className="size-4 shrink-0" aria-hidden />
            <span>
              <strong>Live ledger</strong> – Data fetched from Hyperledger Fabric ({currentDataset.currentOwner || "active"}).
            </span>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* Demo scenario buttons (kept for demos; hidden from live search)     */}
        {/* ------------------------------------------------------------------ */}
        <section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="size-4 text-primary" />
            <span>Select Demo Scenario:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSelectedDatasetKey("standard"); setSearchBatchId(""); }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedDatasetKey === "standard" && !liveData ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              ✅ Standard (2-8°C)
            </button>
            <button
              onClick={() => { setSelectedDatasetKey("excursion"); setSearchBatchId(""); }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedDatasetKey === "excursion" && !liveData ? "bg-destructive text-destructive-foreground border-destructive" : "bg-background hover:bg-muted"}`}
            >
              ⚠️ Thermal Excursion
            </button>
            <button
              onClick={() => { setSelectedDatasetKey("ultralow"); setSearchBatchId(""); }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedDatasetKey === "ultralow" && !liveData ? "bg-blue-600 text-white border-blue-600" : "bg-background hover:bg-muted"}`}
            >
              ❄️ Ultra-Low (-80°C)
            </button>
            {liveData && (
              <button
                onClick={() => { setLiveData(null); setMlResult(null); setIsMock(false); setSearchBatchId(""); setSelectedDatasetKey("standard"); }}
                className="rounded-lg border px-3 py-1.5 text-xs font-medium bg-background hover:bg-muted transition-colors text-muted-foreground"
              >
                ↩ Clear live data
              </button>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Batch ID search – now queries the blockchain                        */}
        {/* ------------------------------------------------------------------ */}
        <section className="mb-8">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter Batch ID (e.g. BATCH_1792760493)…"
                className="w-full rounded-xl border bg-background py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={searchBatchId}
                onChange={(e) => setSearchBatchId(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Searching…" : "Verify"}
            </button>
          </form>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Main verification card                                              */}
        {/* ------------------------------------------------------------------ */}
        <section className="glass animate-rise rounded-3xl border border-white/60 p-6 shadow-xl shadow-primary/5 ring-1 ring-black/[0.03]">
          <StatusBadge status={mappedBatch.status as any} />

          <div className="mt-6 flex flex-col items-center justify-center gap-4 rounded-2xl bg-secondary/60 px-4 py-4 sm:flex-row">
            <div className="flex flex-col items-center gap-2 border-b sm:border-b-0 sm:border-r border-border pb-4 sm:pb-0 sm:pr-4">
              <span className="text-xs text-muted-foreground"><QrCode className="inline size-3 mr-1" /> Scan to Verify</span>
              {loading ? (
                <div className="size-[120px] animate-pulse bg-muted rounded-xl" />
              ) : (
                <img src={qrCodeUrl} alt="QR Code" className="size-[120px] rounded-xl bg-white p-2" />
              )}
              <code className="text-xs text-muted-foreground font-mono bg-background px-2 py-1 rounded">
                {currentDataset.batchId}
              </code>
            </div>
            <div className="flex flex-col gap-3 px-2 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Thermometer className={`size-5 ${isExcursion ? "text-destructive" : "text-safe"}`} aria-hidden />
                <span className="text-sm text-muted-foreground">Live Telemetry:</span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  {mappedBatch.liveTemp.toFixed(1)}{currentDataset.unit}
                </span>
              </div>
              <span className={`inline-flex items-center justify-center sm:justify-start gap-1.5 text-sm font-medium ${isExcursion ? "text-destructive" : "text-safe"}`}>
                <span className={`size-2 rounded-full ${isExcursion ? "bg-destructive" : "bg-safe"} animate-live-dot`} />
                {isExcursion ? "Critical Breach" : "In Safe Range"}
              </span>
              {/* Show source badge */}
              {liveData && !isMock && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <span className="size-1.5 rounded-full bg-primary animate-live-dot" />
                  Fabric Ledger
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Product details                                                     */}
        {/* ------------------------------------------------------------------ */}
        <section className="glass mt-4 animate-rise rounded-3xl border border-white/60 p-5 shadow-lg shadow-primary/5 ring-1 ring-black/[0.03] [animation-delay:80ms]">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Product Details</h2>
          <DrugDetails batch={mappedBatch as any} />
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-secondary/60 px-3 py-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p className="text-xs text-muted-foreground">
              Last custody: <span className="font-medium text-foreground">{mappedBatch.location}</span>
            </p>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Temperature history chart                                           */}
        {/* ------------------------------------------------------------------ */}
        <section className="mt-4 animate-rise [animation-delay:160ms]">
          <TempHistoryChart batchData={currentDataset} isMockData={isMock || !liveData} />
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* ML Anomaly Badge – shows live result from Isolation Forest          */}
        {/* ------------------------------------------------------------------ */}
        <section className="mt-4 animate-rise [animation-delay:240ms]">
          <MlBadge
            batch={mappedBatch as any}
            mlResult={mlResult}
            mlLoading={mlLoading}
          />
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* Blockchain provenance card                                          */}
        {/* ------------------------------------------------------------------ */}
        <section className="mt-4 animate-rise [animation-delay:320ms]">
          <BlockchainCard batch={mappedBatch as any} />
        </section>

        <footer className="mt-8 text-center text-xs text-muted-foreground pb-8">
          Secured by ColdChainRx · Permissioned Hyperledger network
        </footer>
      </div>
    </main>
  );
}
