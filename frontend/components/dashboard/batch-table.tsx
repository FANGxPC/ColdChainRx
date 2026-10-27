"use client";

import React from "react";
import Link from "next/link";
import { Cpu, ArrowRight, CircleAlert, CircleCheck, Check } from "lucide-react";
import { type BatchItem } from "@/lib/api";

type BatchTableProps = {
  batches: BatchItem[];
  selectedBatchId?: string;
  onSelectBatch?: (id: string) => void;
  loading?: boolean;
};

export function BatchTable({
  batches,
  selectedBatchId,
  onSelectBatch,
  loading = false,
}: BatchTableProps) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Active Monitored Batches</h2>
          <p className="text-xs text-muted-foreground">Authoritative ledger feed & live IoT sensor status</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-safe/12 px-2.5 py-1 text-xs font-medium text-safe">
            <span className="size-1.5 rounded-full bg-safe animate-live-dot" />
            Live Sync
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Batch ID & Drug</th>
              <th className="px-5 py-3 font-medium">Assigned Sensor Device</th>
              <th className="px-5 py-3 font-medium">Live Telemetry</th>
              <th className="px-5 py-3 font-medium">Cold-Chain Status</th>
              <th className="px-5 py-3 font-medium">Data Freshness</th>
              <th className="px-5 py-3 font-medium">Ledger State</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-xs text-muted-foreground">
                  Loading batches from Hyperledger Fabric...
                </td>
              </tr>
            ) : batches.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-xs text-muted-foreground">
                  No active batches found on ledger. Register one in the Manufacturer portal.
                </td>
              </tr>
            ) : (
              batches.map((b) => {
                const isSelected = selectedBatchId === b.id;
                const isExcursion = b.coldChainStatus === "Critical Excursion";
                const hasDevice = b.assignedDevice && b.assignedDevice !== "Unassigned";

                return (
                  <tr
                    key={b.id}
                    onClick={() => onSelectBatch?.(b.id)}
                    className={`cursor-pointer border-b border-border/60 last:border-0 transition-colors ${
                      isSelected
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-secondary/40"
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                        )}
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {b.id}
                        </span>
                      </div>
                      <p className="mt-0.5 max-w-[14rem] truncate text-[11px] text-muted-foreground">
                        {b.drugName} · {b.manufacturer}
                      </p>
                    </td>

                    <td className="px-5 py-3.5">
                      {hasDevice ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-foreground">
                          <Cpu className="size-3.5 text-primary" /> {b.assignedDevice}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      {typeof b.latestTemperature === "number" && !isNaN(b.latestTemperature) ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
                            isExcursion
                              ? "bg-alert/15 text-alert font-bold"
                              : "bg-safe/12 text-safe"
                          }`}
                        >
                          {b.latestTemperature.toFixed(1)}°C
                          {typeof b.latestHumidity === "number" && !isNaN(b.latestHumidity) && ` / ${b.latestHumidity.toFixed(0)}%`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          isExcursion
                            ? "bg-alert/12 text-alert"
                            : "bg-safe/12 text-safe"
                        }`}
                      >
                        {isExcursion ? (
                          <CircleAlert className="size-3.5" />
                        ) : (
                          <CircleCheck className="size-3.5" />
                        )}
                        {b.coldChainStatus}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <FreshnessIndicator status={b.freshnessStatus} />
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Check className="size-3" /> {b.rawStatus || b.status || "Manufactured"}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/batch/${b.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary transition"
                      >
                        Details <ArrowRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FreshnessIndicator({ status }: { status: BatchItem["freshnessStatus"] }) {
  if (status === "Streaming Live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-safe/12 px-2.5 py-1 text-xs font-medium text-safe">
        <span className="size-1.5 rounded-full bg-safe animate-live-dot" /> Live
      </span>
    );
  }
  if (status === "Device Offline") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-1 text-xs font-medium text-warn">
        <span className="size-1.5 rounded-full bg-warn" /> Offline
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">No Readings</span>;
}
