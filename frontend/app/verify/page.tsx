"use client";

import React, { useState, useEffect } from 'react';
import Link from "next/link"
import { Snowflake, MapPin, Thermometer, ArrowLeft, Search, Sparkles, QrCode } from "lucide-react"
import { mockTelemetryDatasets } from "@/lib/data/mockTelemetryData"
import { StatusBadge } from "@/components/verify/status-badge"
import { DrugDetails } from "@/components/verify/drug-details"
import { BlockchainCard } from "@/components/verify/blockchain-card"
import TempHistoryChart from "@/components/TempHistoryChart"
import { MlBadge } from "@/components/verify/ml-badge"

export default function VerifyPage() {
  const [selectedDatasetKey, setSelectedDatasetKey] = useState('standard');
  const [searchBatchId, setSearchBatchId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Suppress hydration mismatch warning since we render client-side only mock data dynamically
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const currentDataset = (mockTelemetryDatasets as any)[selectedDatasetKey] || mockTelemetryDatasets.standard;

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
        // Fallback
      }
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
        `http://localhost:3000/verify/${currentDataset.batchId}`
      )}`);
      setLoading(false);
    }

    if (mounted) fetchQrCode();
  }, [currentDataset.batchId, mounted]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchBatchId.trim()) return;

    const foundKey = Object.keys(mockTelemetryDatasets).find(
      (key) =>
        key.toLowerCase() === searchBatchId.toLowerCase() ||
        (mockTelemetryDatasets as any)[key].batchId.toLowerCase() === searchBatchId.toLowerCase()
    );

    if (foundKey) {
      setSelectedDatasetKey(foundKey);
    } else {
      alert(`Batch "${searchBatchId}" not found in local mock network. Showing default batch.`);
    }
  };

  const isExcursion = currentDataset.status.includes('Breach') || currentDataset.status.includes('Warning');
  
  const mappedBatch = {
    id: currentDataset.batchId,
    status: isExcursion ? 'compromised' : 'authentic',
    drug: currentDataset.drugName,
    manufacturer: currentDataset.manufacturer,
    mfgDate: currentDataset.mfgDate,
    expiry: currentDataset.expiryDate,
    location: currentDataset.readings[currentDataset.readings.length - 1]?.location || "Unknown",
    liveTemp: currentDataset.readings[currentDataset.readings.length - 1]?.temp || 0,
    txHash: "0x7f9a8b2c4d1e3f5a6b7c8d9e0f1a2b3c4d5e6f7a",
    verifiedAt: new Date().toISOString(),
    blockHeight: 124045,
    anomalies: isExcursion ? currentDataset.readings.filter((r: any) => r.status === 'CRITICAL_EXCURSION' || r.status === 'WARNING').length : 0,
    node: "peer0.org1.pharmachain.com"
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

        <section className="mb-6 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="size-4 text-primary" />
            <span>Select Demo Scenario:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedDatasetKey('standard')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedDatasetKey === 'standard' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
            >
              ✅ Standard (2-8°C)
            </button>
            <button
              onClick={() => setSelectedDatasetKey('excursion')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedDatasetKey === 'excursion' ? 'bg-destructive text-destructive-foreground border-destructive' : 'bg-background hover:bg-muted'}`}
            >
              ⚠️ Thermal Excursion
            </button>
            <button
              onClick={() => setSelectedDatasetKey('ultralow')}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${selectedDatasetKey === 'ultralow' ? 'bg-blue-600 text-white border-blue-600' : 'bg-background hover:bg-muted'}`}
            >
              ❄️ Ultra-Low (-80°C)
            </button>
          </div>
        </section>

        <section className="mb-8">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter Batch ID..."
                className="w-full rounded-xl border bg-background py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={searchBatchId}
                onChange={(e) => setSearchBatchId(e.target.value)}
              />
            </div>
            <button type="submit" className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Verify
            </button>
          </form>
        </section>

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
              <code className="text-xs text-muted-foreground font-mono bg-background px-2 py-1 rounded">{currentDataset.batchId}</code>
            </div>
            <div className="flex flex-col gap-3 px-2 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <Thermometer className={`size-5 ${isExcursion ? 'text-destructive' : 'text-safe'}`} aria-hidden />
                <span className="text-sm text-muted-foreground">Live Telemetry:</span>
                <span className="font-mono text-lg font-semibold text-foreground">{mappedBatch.liveTemp}{currentDataset.unit}</span>
              </div>
              <span className={`inline-flex items-center justify-center sm:justify-start gap-1.5 text-sm font-medium ${isExcursion ? 'text-destructive' : 'text-safe'}`}>
                <span className={`size-2 rounded-full ${isExcursion ? 'bg-destructive' : 'bg-safe'} animate-live-dot`} />
                {isExcursion ? 'Critical Breach' : 'In Safe Range'}
              </span>
            </div>
          </div>
        </section>

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

        <section className="mt-4 animate-rise [animation-delay:160ms]">
          <TempHistoryChart batchData={currentDataset} isMockData={true} />
        </section>

        <section className="mt-4 animate-rise [animation-delay:240ms]">
          <MlBadge batch={mappedBatch as any} />
        </section>

        <section className="mt-4 animate-rise [animation-delay:320ms]">
          <BlockchainCard batch={mappedBatch as any} />
        </section>

        <footer className="mt-8 text-center text-xs text-muted-foreground pb-8">
          Secured by ColdChainRx · Permissioned Hyperledger network
        </footer>
      </div>
    </main>
  )
}
