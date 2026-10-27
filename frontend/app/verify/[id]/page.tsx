"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Thermometer,
  Cpu,
  Boxes,
  ArrowLeft,
  Calendar,
  Building2,
  RefreshCw,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { api, type BatchItem } from "@/lib/api";
import TempHistoryChart from "@/components/TempHistoryChart";

type PageProps = {
  params: Promise<{ id: string }>;
};

type VerificationState =
  | "REGISTERED_SAFE"
  | "EXCURSION_DETECTED"
  | "STATUS_UNAVAILABLE"
  | "UNKNOWN_BATCH"
  | "VERIFICATION_ERROR";

export default function ConsumerVerificationPage({ params }: PageProps) {
  const { id } = use(params);

  const [batch, setBatch] = useState<BatchItem | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [mlResult, setMlResult] = useState<{ is_anomaly: boolean; anomaly_score: number } | null>(null);
  const [verState, setVerState] = useState<VerificationState>("STATUS_UNAVAILABLE");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    async function verifyBatch() {
      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await api.getBatch(id);

        if (!res.success || !res.data) {
          if (res.error && res.error.toLowerCase().includes("does not exist")) {
            setVerState("UNKNOWN_BATCH");
            setErrorMsg(`Batch '${id}' could not be verified. It does not exist on the Hyperledger Fabric ledger.`);
          } else {
            setVerState("VERIFICATION_ERROR");
            setErrorMsg(res.error || `Could not complete blockchain verification for '${id}'.`);
          }
          setLoading(false);
          return;
        }

        const b = res.data;
        setBatch(b);
        if (res.qrCode) setQrCodeUrl(res.qrCode);

        // Cold chain status assessment
        const logs = b.readings || b.temperatureLogs || [];
        if (logs.length === 0) {
          setVerState("STATUS_UNAVAILABLE");
        } else if (b.coldChainStatus === "Critical Excursion" || b.excursionAlert) {
          setVerState("EXCURSION_DETECTED");
        } else {
          setVerState("REGISTERED_SAFE");
        }

        // Fetch audit history for Fabric TxID
        api.getBatchHistory(id, 5).then((h) => {
          if (h.success && h.data) setHistory(h.data);
        });

        // Run ML model
        if (logs.length > 0) {
          const last: any = logs[logs.length - 1];
          const temp = last.temp ?? last.temperature;
          const hum = last.humidity ?? 60;
          api.checkAnomaly(id, { temperature: temp, humidity: hum, timestamp: last.timestamp }).then((m) => {
            if (m.success && m.data) setMlResult(m.data);
          });
        }
      } catch (err: any) {
        setVerState("VERIFICATION_ERROR");
        setErrorMsg(err.message || "Failed to communicate with verification gateway.");
      } finally {
        setLoading(false);
      }
    }

    verifyBatch();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-foreground p-6">
        <RefreshCw className="size-8 animate-spin text-primary mb-3" />
        <h1 className="text-base font-bold">Scanning Hyperledger Fabric...</h1>
        <p className="text-xs text-muted-foreground mt-1">Verifying cryptographic batch proof for {id}</p>
      </div>
    );
  }

  // 1. Unknown Batch State (clean, non-accusatory)
  if (verState === "UNKNOWN_BATCH" || verState === "VERIFICATION_ERROR") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warn/15 text-warn mb-4">
            <HelpCircle className="size-6" />
          </div>
          <span className="rounded-full bg-warn/15 px-3 py-1 text-xs font-semibold text-warn">
            {verState === "UNKNOWN_BATCH" ? "Unknown Medicine Batch" : "Verification Unavailable"}
          </span>
          <h1 className="mt-3 text-xl font-bold font-mono text-foreground">{id}</h1>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            {errorMsg || "This batch identifier was not located on the authoritative blockchain ledger. This does not automatically indicate counterfeit product, but authenticity cannot be cryptographically proven."}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/verify"
              className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              Scan Another QR Code
            </Link>
            <Link
              href="/"
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const readings = (batch?.readings || (batch?.temperatureLogs || [])).map((l: any) => ({
    time: new Date(l.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    temp: l.temperature ?? l.temp,
    humidity: l.humidity ?? 60,
    location: l.reporter || batch?.assignedDevice,
    hop: batch?.status,
    status: l.temperature > (batch?.maxTemp ?? 8) || l.temperature < (batch?.minTemp ?? 2) ? "CRITICAL_EXCURSION" : "NORMAL",
  }));

  return (
    <div className="min-h-dvh bg-background text-foreground pb-12">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
        <Link
          href="/verify"
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="size-4" />
          <span>Scan another code</span>
        </Link>

        <span className="flex items-center gap-1.5 text-xs font-semibold text-safe">
          <ShieldCheck className="size-4 text-safe" /> Ledger Verified
        </span>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Verification Status Hero Badge */}
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          {verState === "REGISTERED_SAFE" && (
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-safe/12 text-safe mb-3">
              <CheckCircle2 className="size-7" />
            </div>
          )}
          {verState === "EXCURSION_DETECTED" && (
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-alert/15 text-alert mb-3">
              <AlertTriangle className="size-7" />
            </div>
          )}
          {verState === "STATUS_UNAVAILABLE" && (
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-warn/15 text-warn mb-3">
              <HelpCircle className="size-7" />
            </div>
          )}

          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
              verState === "REGISTERED_SAFE"
                ? "bg-safe/12 text-safe"
                : verState === "EXCURSION_DETECTED"
                ? "bg-alert/15 text-alert"
                : "bg-warn/15 text-warn"
            }`}
          >
            {verState === "REGISTERED_SAFE" && "Authentic & Safe"}
            {verState === "EXCURSION_DETECTED" && "Temperature Breach Detected"}
            {verState === "STATUS_UNAVAILABLE" && "Cold-Chain Status Unavailable"}
          </span>

          <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {batch?.drugName}
          </h1>
          <p className="font-mono text-xs font-semibold text-primary mt-1">Batch ID: {batch?.id}</p>
          <p className="mt-2 text-xs text-muted-foreground max-w-md mx-auto">
            {verState === "REGISTERED_SAFE" &&
              "This medicine batch has been validated on Hyperledger Fabric. All logged temperatures remained strictly within the prescribed cold-chain limits."}
            {verState === "EXCURSION_DETECTED" &&
              "CAUTION: One or more temperature breaches occurred during transit. Consult dispensing pharmacist or physician before administration."}
            {verState === "STATUS_UNAVAILABLE" &&
              "Batch is registered on ledger, but no temperature readings have been transmitted yet by the assigned sensor box."}
          </p>
        </div>

        {/* Medicine Specifications Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Pharmaceutical Specifications
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
              <p className="text-muted-foreground">Manufacturer</p>
              <p className="mt-1 font-semibold text-foreground">{batch?.manufacturer}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
              <p className="text-muted-foreground">Expiry Date</p>
              <p className="mt-1 font-semibold text-foreground">{batch?.expDate || "—"}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
              <p className="text-muted-foreground">Permissible Storage Window</p>
              <p className="mt-1 font-semibold text-foreground">
                {batch?.minTemp}°C to {batch?.maxTemp}°C
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
              <p className="text-muted-foreground">Current Custodian</p>
              <p className="mt-1 font-semibold text-foreground">{batch?.currentOwner}</p>
            </div>
          </div>
        </div>

        {/* Cold-Chain Telemetry Graph */}
        {readings.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Cold-Chain Temperature Journey
            </h2>
            <TempHistoryChart
              data={readings}
              minTemp={batch?.minTemp ?? 2}
              maxTemp={batch?.maxTemp ?? 8}
              unit="°C"
            />
          </div>
        )}

        {/* Blockchain Cryptographic Proof */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hyperledger Fabric Cryptographic Proof
            </h2>
            <span className="font-mono text-[11px] text-safe">Channel: coldchainchannel</span>
          </div>

          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Batch ID:</span>
              <span className="font-mono font-bold text-foreground">{batch?.id}</span>
            </div>
            {history.length > 0 && (
              <div className="flex flex-col gap-1 pt-1">
                <span className="text-muted-foreground">Commit Transaction ID (TxID):</span>
                <span className="font-mono text-[11px] text-primary break-all bg-secondary/40 p-2 rounded-lg">
                  {history[0].txId}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-1">
              <span className="text-muted-foreground">Immutable Ledger State:</span>
              <span className="rounded-full bg-safe/12 px-2 py-0.5 text-[11px] font-semibold text-safe">
                Committed & Endorsed
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
