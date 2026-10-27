"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Factory,
  Boxes,
  Cpu,
  PlusCircle,
  Link2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Search,
  ExternalLink,
  Snowflake,
  Activity,
  ArrowRight
} from "lucide-react";
import { api, type BatchItem, type DeviceItem } from "@/lib/api";

export default function ManufacturerPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Registration Form State ---
  const [regForm, setRegForm] = useState({
    id: `BATCH_${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    drugName: "Covishield Vaccine (ChAdOx1)",
    manufacturer: "Serum Institute of India",
    minTemp: 2.0,
    maxTemp: 8.0,
    mfgDate: new Date().toISOString().split("T")[0],
    expDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
    quantity: 5000,
  });
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<{ message: string; txId: string; batchId: string } | null>(null);

  // --- Assignment Form State ---
  const [assignBatchId, setAssignBatchId] = useState("");
  const [assignDeviceId, setAssignDeviceId] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignPrevBatch, setReassignPrevBatch] = useState<string | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignFeedback, setAssignFeedback] = useState<{ type: "success" | "error"; text: string; txId?: string } | null>(null);

  // --- Device QR Scanner Simulator ---
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [scannedInput, setScannedInput] = useState("");

  // Load live data
  const loadData = useCallback(async () => {
    try {
      const [batchRes, devRes] = await Promise.all([
        api.getBatches(),
        api.getDevices(),
      ]);

      if (batchRes.success && batchRes.data) {
        setBatches(batchRes.data);
        if (!assignBatchId && batchRes.data.length > 0) {
          setAssignBatchId(batchRes.data[0].id);
        }
      }

      if (devRes.success && devRes.data) {
        setDevices(devRes.data);
        if (!assignDeviceId && devRes.data.length > 0) {
          setAssignDeviceId(devRes.data[0].deviceId);
        }
      }
    } catch (err: any) {
      console.error("Failed to load manufacturer data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [assignBatchId, assignDeviceId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // 10s auto-refresh
    return () => clearInterval(interval);
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Generate new random batch ID
  const handleRegenerateId = () => {
    setRegForm((prev) => ({
      ...prev,
      id: `BATCH_${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    }));
  };

  // Submit Batch Registration
  const handleRegisterBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    // Client-side validations
    if (!regForm.id.trim()) {
      setRegError("Batch ID is required.");
      return;
    }
    if (!regForm.drugName.trim()) {
      setRegError("Medicine name is required.");
      return;
    }
    if (!regForm.manufacturer.trim()) {
      setRegError("Manufacturer identification is required.");
      return;
    }
    if (regForm.minTemp >= regForm.maxTemp) {
      setRegError("Minimum storage temperature must be strictly less than maximum storage temperature.");
      return;
    }
    if (new Date(regForm.expDate) <= new Date(regForm.mfgDate)) {
      setRegError("Expiry date must be later than manufacturing date.");
      return;
    }

    setRegSubmitting(true);
    const res = await api.createBatch({
      id: regForm.id.trim(),
      drugName: regForm.drugName.trim(),
      manufacturer: regForm.manufacturer.trim(),
      minTemp: Number(regForm.minTemp),
      maxTemp: Number(regForm.maxTemp),
      mfgDate: regForm.mfgDate,
      expDate: regForm.expDate,
      quantity: Number(regForm.quantity),
    });

    setRegSubmitting(false);

    if (res.success) {
      setRegSuccess({
        message: res.message || "Batch successfully registered.",
        txId: res.txId || "Confirmed on Hyperledger Fabric ledger",
        batchId: regForm.id.trim(),
      });
      // Set newly registered batch in assignment selector
      setAssignBatchId(regForm.id.trim());
      // Refresh list
      loadData();
      // Prepare form for next batch
      handleRegenerateId();
      setRegForm((prev) => ({ ...prev, drugName: "" }));
    } else {
      setRegError(res.error || "Failed to register batch on blockchain.");
    }
  };

  // Initiate Assignment
  const handleInitiateAssign = () => {
    setAssignFeedback(null);
    if (!assignBatchId) {
      setAssignFeedback({ type: "error", text: "Please select a target medicine batch." });
      return;
    }
    if (!assignDeviceId) {
      setAssignFeedback({ type: "error", text: "Please select or scan a sensor device." });
      return;
    }

    // Check if device is already assigned to a DIFFERENT active batch
    const existingDev = devices.find((d) => d.deviceId.toLowerCase() === assignDeviceId.toLowerCase());
    if (existingDev && existingDev.assignedBatch && existingDev.assignedBatch !== assignBatchId) {
      // Reassignment flow needed!
      setReassignPrevBatch(existingDev.assignedBatch);
      setReassignModalOpen(true);
      return;
    }

    // Standard assignment modal
    setAssignModalOpen(true);
  };

  // Execute standard assignment
  const handleConfirmAssignment = async () => {
    setAssignModalOpen(false);
    setAssignSubmitting(true);
    setAssignFeedback(null);

    const res = await api.assignDevice(assignDeviceId, assignBatchId);
    setAssignSubmitting(false);

    if (res.success) {
      setAssignFeedback({
        type: "success",
        text: `Device '${assignDeviceId}' successfully assigned to '${assignBatchId}'.`,
        txId: res.txId,
      });
      loadData();
    } else {
      setAssignFeedback({
        type: "error",
        text: res.error || "Failed to submit assignment transaction to blockchain.",
      });
    }
  };

  // Execute Reassignment (Atomic bind to new batch on Fabric)
  const handleConfirmReassignment = async () => {
    setReassignModalOpen(false);
    setAssignSubmitting(true);
    setAssignFeedback(null);

    try {
      // Fabric chaincode AssignDevice handles atomic reassignment in a single transaction
      const assignRes = await api.assignDevice(assignDeviceId, assignBatchId);
      if (!assignRes.success && !assignRes._fallback) {
        throw new Error(assignRes.error || "Failed to bind device to new batch.");
      }

      setAssignFeedback({
        type: "success",
        text: `Device '${assignDeviceId}' successfully reallocated from '${reassignPrevBatch}' to '${assignBatchId}'. Historical data for '${reassignPrevBatch}' remains immutable on ledger.`,
        txId: assignRes.txId,
      });
      loadData();
    } catch (err: any) {
      setAssignFeedback({
        type: "error",
        text: err.message || "Reassignment workflow failed.",
      });
    } finally {
      setAssignSubmitting(false);
    }
  };

  // Unassign quick button from table
  const handleQuickUnassign = async (deviceId: string, batchId?: string) => {
    if (!confirm(`Are you sure you want to detach and unassign sensor device "${deviceId}"?`)) return;
    setAssignSubmitting(true);
    const res = await api.unassignDevice(deviceId, batchId);
    setAssignSubmitting(false);
    if (res.success) {
      setAssignFeedback({ type: "success", text: `Device ${deviceId} detached successfully.`, txId: res.txId });
      loadData();
    } else {
      setAssignFeedback({ type: "error", text: res.error || "Failed to detach device." });
    }
  };

  // Filtered batches
  const filteredBatches = batches.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.id.toLowerCase().includes(q) ||
      b.drugName.toLowerCase().includes(q) ||
      b.assignedDevice.toLowerCase().includes(q) ||
      b.manufacturer.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-foreground hover:opacity-80">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Snowflake className="size-5" />
            </div>
            <span className="font-semibold tracking-tight">
              ColdChain<span className="text-primary">Rx</span>
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Factory className="size-3.5" /> Manufacturer Operations
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Syncing..." : "Sync Ledger"}
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-secondary"
          >
            <Activity className="size-3.5 text-primary" /> Live IoT Dashboard
          </Link>
          <Link
            href="/verify"
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <QrCode className="size-3.5" /> Consumer QR Portal
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 p-6">
        {/* Header & Stats Banner */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Manufacturer Command Portal
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Register pharmaceutical batches on Hyperledger Fabric and establish authoritative batch-to-device associations.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
              <p className="text-[11px] font-medium text-muted-foreground">Registered Batches</p>
              <p className="text-lg font-bold text-foreground">{batches.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
              <p className="text-[11px] font-medium text-muted-foreground">Active Sensors</p>
              <p className="text-lg font-bold text-safe">{devices.filter((d) => d.status === "Assigned").length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
              <p className="text-[11px] font-medium text-muted-foreground">Sensors Available</p>
              <p className="text-lg font-bold text-primary">{devices.filter((d) => d.status === "Available").length}</p>
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {assignFeedback && (
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${
              assignFeedback.type === "success"
                ? "border-safe/30 bg-safe/10 text-safe"
                : "border-alert/30 bg-alert/10 text-alert"
            }`}
          >
            {assignFeedback.type === "success" ? (
              <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{assignFeedback.text}</p>
              {assignFeedback.txId && (
                <p className="mt-1 font-mono text-xs opacity-90 truncate">
                  Fabric TxID: {assignFeedback.txId}
                </p>
              )}
            </div>
            <button
              onClick={() => setAssignFeedback(null)}
              className="text-xs font-semibold opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Section 1: Twin Panels (Batch Registration & Sensor Device Assignment) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Panel A: Register Medicine Batch (Requirement 3.1) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PlusCircle className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">1. Register Medicine Batch</h2>
                  <p className="text-xs text-muted-foreground">Commits immutable batch specs to blockchain ledger</p>
                </div>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                Hyperledger Fabric v2.5
              </span>
            </div>

            {regSuccess && (
              <div className="mt-4 rounded-xl border border-safe/30 bg-safe/10 p-3.5 text-xs text-safe">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-4" /> Batch {regSuccess.batchId} Committed Successfully
                </div>
                <p className="mt-1 font-mono text-[11px] text-foreground truncate">
                  TxID: {regSuccess.txId}
                </p>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/batch/${regSuccess.batchId}`}
                    className="inline-flex items-center gap-1 font-medium underline hover:text-foreground"
                  >
                    View Batch Details <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            )}

            {regError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-alert/30 bg-alert/10 p-3.5 text-xs text-alert">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterBatch} className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground">Batch ID *</label>
                    <button
                      type="button"
                      onClick={handleRegenerateId}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={regForm.id}
                    onChange={(e) => setRegForm({ ...regForm, id: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:bg-card"
                    placeholder="e.g. BATCH001"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Medicine Name *</label>
                  <input
                    type="text"
                    required
                    value={regForm.drugName}
                    onChange={(e) => setRegForm({ ...regForm, drugName: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs outline-none focus:border-primary focus:bg-card"
                    placeholder="e.g. Covishield Vaccine (ChAdOx1)"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Manufacturer Name *</label>
                <input
                  type="text"
                  required
                  value={regForm.manufacturer}
                  onChange={(e) => setRegForm({ ...regForm, manufacturer: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs outline-none focus:border-primary focus:bg-card"
                  placeholder="e.g. Serum Institute of India"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-foreground">Manufacturing Date *</label>
                  <input
                    type="date"
                    required
                    value={regForm.mfgDate}
                    onChange={(e) => setRegForm({ ...regForm, mfgDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs outline-none focus:border-primary focus:bg-card"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={regForm.expDate}
                    onChange={(e) => setRegForm({ ...regForm, expDate: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs outline-none focus:border-primary focus:bg-card"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Min Temp (°C) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={regForm.minTemp}
                    onChange={(e) => setRegForm({ ...regForm, minTemp: parseFloat(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs outline-none focus:border-primary focus:bg-card"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Max Temp (°C) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={regForm.maxTemp}
                    onChange={(e) => setRegForm({ ...regForm, maxTemp: parseFloat(e.target.value) })}
                    className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs outline-none focus:border-primary focus:bg-card"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground">Batch Quantity</label>
                  <input
                    type="number"
                    value={regForm.quantity}
                    onChange={(e) => setRegForm({ ...regForm, quantity: parseInt(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs outline-none focus:border-primary focus:bg-card"
                    placeholder="e.g. 5000"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Configured Storage Window: </span>
                {regForm.minTemp < 0
                  ? `Ultra-Low Cryo Vault (${regForm.minTemp}°C to ${regForm.maxTemp}°C)`
                  : `Cold Chain Storage (${regForm.minTemp}°C – ${regForm.maxTemp}°C)`}
              </div>

              <button
                type="submit"
                disabled={regSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
              >
                {regSubmitting ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Submitting to Hyperledger Fabric...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" /> Commit Batch to Blockchain
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Panel B: Authoritative Sensor Box Assignment (Requirement 3.2 & 3.4) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-safe/12 text-safe">
                  <Link2 className="size-4.5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">2. Assign Sensor Box</h2>
                  <p className="text-xs text-muted-foreground">Authoritative binding between ESP32 device & medicine</p>
                </div>
              </div>
              <span className="rounded-full bg-safe/12 px-2.5 py-0.5 text-[11px] font-medium text-safe">
                Hardware Binding
              </span>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              {/* Batch Selector */}
              <div>
                <label className="text-xs font-medium text-foreground">Select Medicine Batch *</label>
                <select
                  value={assignBatchId}
                  onChange={(e) => setAssignBatchId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs outline-none focus:border-primary focus:bg-card"
                >
                  <option value="">-- Choose a registered batch --</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} — {b.drugName} (Current: {b.assignedDevice || "Unassigned"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Device Selector + QR Scanner Action */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Select or Scan Sensor Box *</label>
                  <button
                    type="button"
                    onClick={() => setQrModalOpen(true)}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <QrCode className="size-3.5" /> Scan Device QR
                  </button>
                </div>

                <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <select
                    value={assignDeviceId}
                    onChange={(e) => setAssignDeviceId(e.target.value)}
                    className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs outline-none focus:border-primary focus:bg-card"
                  >
                    <option value="">-- Select Registered Device --</option>
                    {devices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.deviceId} ({d.status} {d.assignedBatch ? `➔ ${d.assignedBatch}` : ""})
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={assignDeviceId}
                    onChange={(e) => setAssignDeviceId(e.target.value)}
                    placeholder="Or type Device ID (e.g. BOX001)"
                    className="rounded-xl border border-border bg-secondary/50 px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:bg-card"
                  />
                </div>
              </div>

              {/* Device Status Insight Preview */}
              {assignDeviceId && (
                <div className="rounded-xl border border-border/80 bg-secondary/20 p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Cpu className="size-3.5 text-primary" /> Device: {assignDeviceId}
                    </span>
                    {(() => {
                      const dev = devices.find((d) => d.deviceId.toLowerCase() === assignDeviceId.toLowerCase());
                      if (!dev) return <span className="text-muted-foreground">Unregistered Device</span>;
                      if (dev.status === "Assigned") {
                        return (
                          <span className="rounded-full bg-warn/15 px-2 py-0.5 font-medium text-warn">
                            In Use (Assigned to {dev.assignedBatch})
                          </span>
                        );
                      }
                      return (
                        <span className="rounded-full bg-safe/12 px-2 py-0.5 font-medium text-safe">
                          Available for Assignment
                        </span>
                      );
                    })()}
                  </div>
                  <p className="mt-1 text-muted-foreground text-[11px]">
                    The IoT device publishes temperature readings with this Device ID. Hyperledger Fabric resolves it to the authoritative batch.
                  </p>
                </div>
              )}

              {/* Assignment Notice & Confirmation Trigger */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleInitiateAssign}
                  disabled={assignSubmitting || !assignBatchId || !assignDeviceId}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-safe px-4 py-2.5 text-xs font-semibold text-safe-foreground shadow-sm transition hover:bg-safe/90 disabled:opacity-50"
                >
                  <Link2 className="size-4" /> Link Sensor Box to Medicine Batch
                </button>
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-3 text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Authoritative Binding Rule: </span>
                Frontend does not simulate reading routing. Once linked on Fabric, MQTT telemetry published by this ESP32 is permanently attributed to this batch until reassigned.
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Active Batches & Assignment Status Tracker (Requirement 3.3) */}
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">3. Active Batches & Assignment Status</h2>
              <p className="text-xs text-muted-foreground">
                Authoritative backend assignment statuses, live temperatures, and sensor telemetry health
              </p>
            </div>

            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search batch, drug, sensor..."
                className="h-8 w-full rounded-xl border border-border bg-secondary/50 pl-8 pr-3 text-xs outline-none focus:border-primary focus:bg-card"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Batch Identification</th>
                  <th className="px-5 py-3 font-medium">Assigned Sensor Device</th>
                  <th className="px-5 py-3 font-medium">Assignment Status</th>
                  <th className="px-5 py-3 font-medium">Live Telemetry</th>
                  <th className="px-5 py-3 font-medium">Freshness Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                      <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-primary" />
                      Loading authoritative batch records...
                    </td>
                  </tr>
                ) : filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                      No matching batches found. Register a new batch above.
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => {
                    const isAssigned = b.assignedDevice && b.assignedDevice !== "Unassigned";
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-border/50 last:border-0 hover:bg-secondary/30 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <Link href={`/batch/${b.id}`} className="font-mono font-semibold text-primary hover:underline">
                            {b.id}
                          </Link>
                          <p className="mt-0.5 text-[11px] text-muted-foreground font-medium truncate max-w-xs">
                            {b.drugName} · {b.manufacturer}
                          </p>
                        </td>

                        <td className="px-5 py-3.5">
                          {isAssigned ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                              <Cpu className="size-3.5 text-primary" /> {b.assignedDevice}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Unassigned</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          <AssignmentStatusBadge status={b.assignmentStatus} />
                        </td>

                        <td className="px-5 py-3.5">
                          {typeof b.latestTemperature === "number" && !isNaN(b.latestTemperature) ? (
                            <span
                              className={`font-mono font-semibold ${
                                b.coldChainStatus === "Critical Excursion"
                                  ? "text-alert font-bold"
                                  : "text-safe"
                              }`}
                            >
                              {b.latestTemperature.toFixed(1)}°C
                              {typeof b.latestHumidity === "number" && !isNaN(b.latestHumidity) && ` / ${b.latestHumidity.toFixed(0)}%`}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          <FreshnessBadge status={b.freshnessStatus} />
                        </td>

                        <td className="px-5 py-3.5 text-right space-x-2">
                          <Link
                            href={`/batch/${b.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-secondary transition"
                          >
                            Details <ArrowRight className="size-3" />
                          </Link>

                          {isAssigned && (
                            <button
                              onClick={() => handleQuickUnassign(b.assignedDevice, b.id)}
                              className="rounded-lg border border-alert/30 bg-alert/10 px-2 py-1 text-[11px] font-medium text-alert hover:bg-alert/20 transition"
                            >
                              Detach Box
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Confirmation Modal 1: Standard Assignment (Requirement 3.2) */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-safe/12 text-safe">
                <Link2 className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Confirm Device Assignment</h3>
                <p className="text-xs text-muted-foreground">Submit authoritative association to ledger</p>
              </div>
            </div>

            <div className="my-5 rounded-xl border border-border/80 bg-secondary/30 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Medicine Batch:</span>
                <span className="font-mono font-semibold text-foreground">{assignBatchId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sensor Device:</span>
                <span className="font-mono font-semibold text-primary">{assignDeviceId}</span>
              </div>
              <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                Confirmation prompt: <strong>&quot;Assign {assignDeviceId} to {assignBatchId}?&quot;</strong>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-5">
              The backend will establish this mapping on Hyperledger Fabric. Readings transmitted by this sensor will be attributed to this batch.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssignment}
                className="rounded-xl bg-safe px-4 py-2 text-xs font-semibold text-safe-foreground hover:bg-safe/90"
              >
                Confirm & Persist Association
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal 2: Reassignment Workflow (Requirement 3.4) */}
      {reassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-alert/40 bg-card p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-alert/15 text-alert">
                <RotateCcw className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Sensor Reassignment Required</h3>
                <p className="text-xs text-muted-foreground">Device is currently attached to another batch</p>
              </div>
            </div>

            <div className="my-5 rounded-xl border border-alert/30 bg-alert/5 p-4 space-y-2 text-xs">
              <p className="font-medium text-alert">
                Sensor box <strong>{assignDeviceId}</strong> is currently assigned to batch <strong>{reassignPrevBatch}</strong>.
              </p>
              <p className="text-muted-foreground text-[11px]">
                Per pharmaceutical cold chain safety protocol:
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] text-muted-foreground">
                <li>Close previous shipment assignment for <strong>{reassignPrevBatch}</strong>.</li>
                <li>Preserve previous batch&apos;s immutable historical readings on ledger.</li>
                <li>Assign sensor device to new batch <strong>{assignBatchId}</strong>.</li>
                <li>Ensure future readings are attributed to <strong>{assignBatchId}</strong> only.</li>
              </ol>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReassignModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
              >
                Abort
              </button>
              <button
                type="button"
                onClick={handleConfirmReassignment}
                className="rounded-xl bg-alert px-4 py-2 text-xs font-semibold text-alert-foreground hover:bg-alert/90"
              >
                Close Previous & Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Device QR Code Scanner Simulator Modal (Requirement 6.1) */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <QrCode className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Scan Sensor Device QR</h3>
                <p className="text-xs text-muted-foreground">Simulate barcode/QR scan from sensor hardware</p>
              </div>
            </div>

            <div className="my-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {["BOX001", "BOX002", "BOX003", "Sensor_Omkar_01"].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setAssignDeviceId(code);
                      setQrModalOpen(false);
                    }}
                    className="rounded-lg border border-border bg-secondary/50 px-2.5 py-1 text-xs font-mono font-medium hover:bg-primary hover:text-primary-foreground transition"
                  >
                    Scan {code}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Or enter scanned QR raw payload:</label>
                <input
                  type="text"
                  value={scannedInput}
                  onChange={(e) => setScannedInput(e.target.value)}
                  placeholder="e.g. BOX001"
                  className="mt-1 w-full rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-mono outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scannedInput.trim()) {
                    setAssignDeviceId(scannedInput.trim());
                    setQrModalOpen(false);
                  }
                }}
                className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Use Scanned ID
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignmentStatusBadge({ status }: { status: BatchItem["assignmentStatus"] }) {
  const styles: Record<BatchItem["assignmentStatus"], { bg: string; text: string; label: string }> = {
    Unassigned: { bg: "bg-muted text-muted-foreground", text: "text-muted-foreground", label: "Unassigned" },
    Assigned: { bg: "bg-primary/10 text-primary", text: "text-primary", label: "Assigned" },
    Monitoring: { bg: "bg-safe/12 text-safe", text: "text-safe", label: "Monitoring" },
    "Shipment Completed": { bg: "bg-purple-500/15 text-purple-600 dark:text-purple-400", text: "text-purple-600", label: "Shipment Completed" },
    "Assignment Error": { bg: "bg-alert/12 text-alert", text: "text-alert", label: "Assignment Error" },
  };

  const s = styles[status] || styles.Unassigned;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.bg}`}>
      {status === "Monitoring" && <span className="size-1.5 rounded-full bg-safe animate-pulse" />}
      {s.label}
    </span>
  );
}

function FreshnessBadge({ status }: { status: BatchItem["freshnessStatus"] }) {
  if (status === "Streaming Live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-safe/12 px-2 py-0.5 text-[10px] font-semibold text-safe">
        <span className="size-1.5 rounded-full bg-safe animate-live-dot" /> Streaming Live
      </span>
    );
  }
  if (status === "Device Offline") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-semibold text-warn">
        <span className="size-1.5 rounded-full bg-warn" /> Device Offline
      </span>
    );
  }
  return <span className="text-[10px] text-muted-foreground">No Telemetry</span>;
}
