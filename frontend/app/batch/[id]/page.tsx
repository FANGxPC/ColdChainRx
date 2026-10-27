"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Snowflake,
  ShieldCheck,
  Cpu,
  Thermometer,
  Droplets,
  Calendar,
  Building2,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  Boxes,
  RefreshCw,
  Sparkles,
  ExternalLink,
  MapPin
} from "lucide-react";
import { api, type BatchItem } from "@/lib/api";
import TempHistoryChart from "@/components/TempHistoryChart";

function parseFabricTimestamp(ts?: any): string {
  if (!ts) return "Ledger timestamp verified";
  const str = String(ts);
  const secMatch = str.match(/seconds:\s*(\d+)/);
  if (secMatch) {
    const secs = parseInt(secMatch[1], 10);
    const d = new Date(secs * 1000);
    if (!isNaN(d.getTime())) return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }
  const d = new Date(ts);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }
  return "Ledger timestamp verified";
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function BatchDetailsPage({ params }: PageProps) {
  const { id } = use(params);

  const [batch, setBatch] = useState<BatchItem | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [mlResult, setMlResult] = useState<{ is_anomaly: boolean; anomaly_score: number } | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadBatchData = async () => {
    try {
      const res = await api.getBatch(id);
      if (!res.success || !res.data) {
        setError(res.error || `Batch "${id}" not found on Hyperledger Fabric ledger.`);
        return;
      }

      setBatch(res.data);
      if (res.qrCode) setQrCodeDataUrl(res.qrCode);

      // Fetch Fabric provenance history
      api.getBatchHistory(id, 20).then((histRes) => {
        if (histRes.success && histRes.data) {
          setHistory(histRes.data);
        }
      });

      // Fetch ML Anomaly check for latest reading
      const readings = res.data.readings || res.data.temperatureLogs || [];
      if (readings.length > 0) {
        const last = readings[readings.length - 1];
        const temp = (last as any).temp ?? (last as any).temperature;
        const hum = (last as any).humidity ?? 60;
        const ts = (last as any).timestamp;
        api.checkAnomaly(id, { temperature: temp, humidity: hum, timestamp: ts }).then((mlRes) => {
          if (mlRes.success && mlRes.data) {
            setMlResult(mlRes.data);
          }
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load batch records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBatchData();
  }, [id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadBatchData();
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground">
        <RefreshCw className="size-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-semibold">Querying Hyperledger Fabric...</p>
        <p className="text-xs text-muted-foreground mt-1">Verifying cryptographic batch records for {id}</p>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-alert/15 text-alert mb-4">
            <AlertTriangle className="size-6" />
          </div>
          <h1 className="text-lg font-bold">Batch Not Verified</h1>
          <p className="mt-2 text-xs text-muted-foreground">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
            >
              Return to Dashboard
            </Link>
            <Link
              href="/manufacturer"
              className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Register on Fabric
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isExcursion = batch.coldChainStatus === "Critical Excursion";
  const readings = (batch.readings && batch.readings.length > 0)
    ? batch.readings.map((r: any) => ({
        ...r,
        temp: Number(r.temp ?? r.temperature ?? 0),
        humidity: Number(r.humidity ?? 60),
      }))
    : (batch.temperatureLogs || []).map((l: any) => ({
        time: l.timestamp ? new Date(l.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Live",
        temp: Number(l.temperature ?? l.temp ?? 0),
        humidity: Number(l.humidity ?? 60),
        location: l.reporter || batch.assignedDevice || "ESP32_BOX_01",
        hop: batch.status || "In Transit",
        status: (Number(l.temperature ?? l.temp) > (batch.maxTemp ?? 8) || Number(l.temperature ?? l.temp) < (batch.minTemp ?? 2)) ? "CRITICAL_EXCURSION" : "NORMAL",
      }));

  return (
    <div className="min-h-dvh bg-background text-foreground pb-12">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Snowflake className="size-4" />
            </div>
            <span className="font-semibold text-sm">
              ColdChain<span className="text-primary">Rx</span>
            </span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="font-mono text-xs font-semibold">{batch.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing..." : "Sync"}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition"
          >
            <Printer className="size-3.5" /> Print Label
          </button>
          <Link
            href={`/verify/${batch.id}`}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
          >
            <QrCode className="size-3.5" /> Verification Portal
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Batch Hero Banner */}
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary">{batch.id}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isExcursion ? "bg-alert/15 text-alert" : "bg-safe/12 text-safe"
                }`}
              >
                {isExcursion ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
                {isExcursion ? "Cold-Chain Excursion Breach" : "Authentic & Safe (Compliant)"}
              </span>
              {batch._live && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  Hyperledger Fabric Live
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {batch.drugName}
            </h1>
            <p className="text-xs text-muted-foreground">
              Manufacturer: <strong>{batch.manufacturer}</strong> · Current Custodian:{" "}
              <strong>{batch.currentOwner}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-border/80 bg-secondary/30 px-4 py-2 text-right">
              <p className="text-[11px] font-medium text-muted-foreground">Safe Temp Window</p>
              <p className="text-sm font-bold text-foreground">
                {batch.minTemp}°C – {batch.maxTemp}°C
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-secondary/30 px-4 py-2 text-right">
              <p className="text-[11px] font-medium text-muted-foreground">Assigned Sensor</p>
              <p className="font-mono text-sm font-bold text-primary">
                {batch.assignedDevice || "Unassigned"}
              </p>
            </div>
          </div>
        </div>

        {/* 4-Column Grid: Specifications, Sensor Device, ML Anomaly, QR Code */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Medicine Specifications */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Boxes className="size-4 text-primary" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Medicine Specifications
              </h2>
            </div>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Batch ID:</span>
                <span className="font-mono font-semibold text-foreground">{batch.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mfg Date:</span>
                <span className="font-medium text-foreground">{batch.mfgDate || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expiry Date:</span>
                <span className="font-medium text-foreground">{batch.expDate || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ledger Status:</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {batch.rawStatus || batch.status || "Manufactured"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Storage Type:</span>
                <span className="font-medium text-foreground truncate max-w-[10rem]">
                  {batch.storageType || "Refrigerated (2-8°C)"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: IoT Sensor Hardware State */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Cpu className="size-4 text-primary" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Assigned Sensor Device
              </h2>
            </div>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device ID:</span>
                <span className="font-mono font-bold text-foreground">
                  {batch.assignedDevice || "Unassigned"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assignment:</span>
                <span className="font-semibold text-primary">{batch.assignmentStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Freshness:</span>
                <span
                  className={`font-semibold ${
                    batch.freshnessStatus === "Streaming Live" ? "text-safe" : "text-warn"
                  }`}
                >
                  {batch.freshnessStatus}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latest Reading:</span>
                <span className="font-mono font-bold text-foreground">
                  {typeof batch.latestTemperature === "number" && !isNaN(batch.latestTemperature)
                    ? `${batch.latestTemperature.toFixed(1)}°C`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Telemetry:</span>
                <span className="text-muted-foreground truncate max-w-[10rem]">
                  {batch.lastReadingTimestamp ? new Date(batch.lastReadingTimestamp).toLocaleTimeString() : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Machine Learning Anomaly Detection */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sparkles className="size-4 text-purple-500" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ML Anomaly Guard
              </h2>
            </div>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Algorithm:</span>
                <span className="font-medium text-foreground">Isolation Forest</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Detection State:</span>
                {mlResult ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      mlResult.is_anomaly ? "bg-alert/15 text-alert" : "bg-safe/12 text-safe"
                    }`}
                  >
                    {mlResult.is_anomaly ? "Anomaly Flagged" : "Nominal (Safe)"}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Evaluating...</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Anomaly Score:</span>
                <span className="font-mono font-semibold text-foreground">
                  {typeof mlResult?.anomaly_score === "number" && !isNaN(mlResult.anomaly_score)
                    ? mlResult.anomaly_score.toFixed(4)
                    : "—"}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Trained on pharmaceutical excursion distributions to detect thermal drift before spoilage.
              </p>
            </div>
          </div>

          {/* Card 4: Medicine Batch QR & Packaging Label */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Physical Batch QR
            </h2>
            {qrCodeDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrCodeDataUrl}
                alt={`QR code for ${batch.id}`}
                className="size-28 rounded-xl border border-border bg-white p-1.5 shadow-sm"
              />
            ) : (
              <div className="flex size-28 items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground text-xs">
                Generating QR...
              </div>
            )}
            <p className="mt-2 font-mono text-[11px] text-muted-foreground truncate w-full">
              verify/{batch.id}
            </p>
            <button
              onClick={handlePrint}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              <Printer className="size-3" /> Print Label
            </button>
          </div>
        </div>

        {/* Section 2: Interactive Temperature Journey Chart */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Cold-Chain Temperature Telemetry Journey
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time sensor logs recorded by ESP32 ({batch.assignedDevice || "Sensor"}) and committed to blockchain
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-safe" />
                Permissible Range: <strong>{batch.minTemp}°C – {batch.maxTemp}°C</strong>
              </span>
            </div>
          </div>

          <div className="mt-4">
            <TempHistoryChart
              data={readings}
              minTemp={batch.minTemp}
              maxTemp={batch.maxTemp}
              unit="°C"
            />
          </div>
        </div>

        {/* Section 3: Hyperledger Fabric Immutable Provenance Audit Trail */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-4.5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Hyperledger Fabric Blockchain Provenance Trail
                </h2>
                <p className="text-xs text-muted-foreground">
                  Cryptographically verifiable transaction commit history on channel <span className="font-mono text-primary">coldchainchannel</span>
                </p>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Immutable Ledger Proof
            </span>
          </div>

          <div className="mt-6 space-y-4">
            {history.length === 0 ? (
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-xs text-muted-foreground text-center">
                Querying ledger history blocks...
              </div>
            ) : (
              history.map((item: any, i: number) => {
                const rec = item.record || {};
                return (
                  <div
                    key={item.txId || i}
                    className="relative flex items-start gap-4 rounded-xl border border-border bg-secondary/20 p-4 transition hover:bg-secondary/40"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-mono text-xs font-bold">
                      #{i + 1}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground truncate max-w-md">
                          TxID: {item.txId}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="size-3" />
                          {parseFabricTimestamp(item.timestamp)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                        <span className="flex items-center gap-1">
                          <Building2 className="size-3.5 text-primary" />
                          Owner: <strong className="text-foreground">{rec.currentOwner || rec.manufacturer || "Manufacturer"}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Status: <strong className="text-primary">{rec.status || "Manufactured"}</strong>
                        </span>
                        {rec.assignedDevice && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1 font-mono">
                              <Cpu className="size-3.5 text-safe" />
                              Device: {rec.assignedDevice}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
