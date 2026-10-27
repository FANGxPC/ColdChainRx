"use client";

import { Boxes, TriangleAlert, Cpu, Network, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { type BatchItem } from "@/lib/api";

type MetricCardsProps = {
  batches?: BatchItem[];
};

export function MetricCards({ batches }: MetricCardsProps) {
  // If live batches are provided, compute real dynamic metrics
  const totalBatches = batches ? batches.length : 12;
  const activeExcursions = batches
    ? batches.filter((b) => b.coldChainStatus === "Critical Excursion").length
    : 1;
  const activeSensors = batches
    ? batches.filter((b) => b.assignedDevice && b.assignedDevice !== "Unassigned").length
    : 8;
  const streamingLive = batches
    ? batches.filter((b) => b.freshnessStatus === "Streaming Live").length
    : 3;

  const cardItems = [
    {
      label: "Monitored Batches",
      value: String(totalBatches),
      delta: `${totalBatches} active`,
      tone: "brand" as const,
      icon: Boxes,
    },
    {
      label: "Active Excursions",
      value: String(activeExcursions),
      delta: activeExcursions > 0 ? "Excursion alert" : "Zero breach",
      tone: activeExcursions > 0 ? ("alert" as const) : ("safe" as const),
      icon: TriangleAlert,
    },
    {
      label: "Assigned Sensor Boxes",
      value: String(activeSensors),
      delta: `${streamingLive} streaming`,
      tone: "safe" as const,
      icon: Cpu,
    },
    {
      label: "Fabric Ledger Endorsement",
      value: "100%",
      delta: "Channel active",
      tone: "brand" as const,
      icon: Network,
    },
  ];

  const toneMap = {
    brand: { text: "text-primary", bg: "bg-primary/10", ring: "ring-primary/15" },
    safe: { text: "text-safe", bg: "bg-safe/10", ring: "ring-safe/15" },
    alert: { text: "text-alert", bg: "bg-alert/10", ring: "ring-alert/15" },
    warn: { text: "text-warn", bg: "bg-warn/15", ring: "ring-warn/20" },
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cardItems.map((m) => {
        const tone = toneMap[m.tone];
        return (
          <div
            key={m.label}
            className={cn(
              "rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-transparent transition-shadow hover:shadow-md",
              tone.ring
            )}
          >
            <div className="flex items-center justify-between">
              <div className={cn("flex size-10 items-center justify-center rounded-xl", tone.bg, tone.text)}>
                <m.icon className="size-5" aria-hidden />
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium",
                  m.tone === "alert" ? "text-alert font-bold" : "text-muted-foreground"
                )}
              >
                {m.delta}
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{m.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{m.label}</p>
          </div>
        );
      })}
    </div>
  );
}
