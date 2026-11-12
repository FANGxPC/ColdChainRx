"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Bell, Snowflake, RefreshCw, Factory, QrCode } from "lucide-react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { BatchTable } from "@/components/dashboard/batch-table";
import { TelemetryGraph } from "@/components/dashboard/telemetry-graph";
import { AlertsFeed } from "@/components/dashboard/alerts-feed";
import { api, type BatchItem } from "@/lib/api";

export default function DashboardPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("BATCH001");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadBatches = useCallback(async () => {
    try {
      const res = await api.getBatches();
      if (res.success && res.data) {
        setBatches(res.data);
        // If current selectedBatchId is not set or not found, select first batch
        if (!selectedBatchId && res.data.length > 0) {
          setSelectedBatchId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    loadBatches();
    const interval = setInterval(loadBatches, 5000); // 5s live streaming poll
    return () => clearInterval(interval);
  }, [loadBatches]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadBatches();
  };

  // Find currently selected batch object
  const selectedBatch =
    batches.find((b) => b.id.toLowerCase() === selectedBatchId.toLowerCase()) ||
    batches[0] ||
    null;

  // Filter batches by search query
  const filteredBatches = batches.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.id.toLowerCase().includes(q) ||
      b.drugName.toLowerCase().includes(q) ||
      b.assignedDevice.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="glass sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border px-4 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Snowflake className="size-4" aria-hidden />
            </div>
            <span className="text-sm font-semibold">
              ColdChain<span className="text-primary">Rx</span>
            </span>
          </div>

          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search batch ID, drug, or sensor..."
              className="h-9 w-full rounded-xl border border-border bg-secondary/50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-card"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Polling..." : "Refresh"}
            </button>

            <Link
              href="/manufacturer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
            >
              <Factory className="size-3.5" /> Manufacturer Hub
            </Link>

            <span className="hidden items-center gap-1.5 rounded-full bg-safe/12 px-2.5 py-1 text-xs font-medium text-safe sm:inline-flex">
              <span className="size-1.5 rounded-full bg-safe animate-live-dot" />
              Fabric Ledger Active
            </span>
          </div>
        </header>

        <main className="flex-1 space-y-5 p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Supply Chain & Telemetry Overview
              </h1>
              <p className="text-sm text-muted-foreground">
                Live IoT monitoring across Hyperledger Fabric nodes.
              </p>
            </div>
          </div>

          <MetricCards batches={batches} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <TelemetryGraph batch={selectedBatch} loading={loading} />
            </div>
            <div className="min-w-0">
              <AlertsFeed />
            </div>
          </div>

          <BatchTable
            batches={filteredBatches}
            selectedBatchId={selectedBatch?.id}
            onSelectBatch={(id) => setSelectedBatchId(id)}
            loading={loading}
          />
        </main>
      </div>
    </div>
  );
}
