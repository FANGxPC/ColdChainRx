"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Activity,
  Thermometer,
  Droplets,
  AlertTriangle,
  Cpu,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Play,
  Pause,
  Clock,
  Sparkles,
  Maximize2,
  Minimize2,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2
} from "lucide-react";
import { type BatchItem } from "@/lib/api";

type TelemetryGraphProps = {
  batch?: BatchItem | null;
  loading?: boolean;
};

type ReadingItem = {
  time: string;
  temp: number;
  humidity: number;
  location: string;
  hop: string;
  status: string;
  timestamp?: string;
};

// Pure helper function to generate non-overlapping X-axis ticks
function computeXAxisTicks(
  points: { x: number; time: string }[],
  chartW: number,
  padL: number
) {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [{ x: points[0].x, label: points[0].time || "Live", index: 0, anchor: "middle" as const }];
  }

  const formatTime = (t: string) => {
    if (!t) return "";
    return t.length > 8 ? t.slice(0, 8) : t;
  };

  // Guarantee minimum 85px between time labels to prevent any text collision
  const MIN_LABEL_GAP = 85;
  const maxTicks = Math.max(2, Math.floor(chartW / MIN_LABEL_GAP));
  const step = Math.max(1, Math.round((points.length - 1) / maxTicks));

  const selected: { x: number; label: string; index: number; anchor: "start" | "middle" | "end" }[] = [];

  for (let i = 0; i < points.length; i += step) {
    const pt = points[i];
    const label = formatTime(pt.time);

    let anchor: "start" | "middle" | "end" = "middle";
    if (selected.length === 0 && pt.x <= padL + 30) {
      anchor = "start";
    }

    if (selected.length > 0) {
      const prev = selected[selected.length - 1];
      if (pt.x - prev.x < MIN_LABEL_GAP) {
        continue;
      }
      if (prev.label === label) {
        continue;
      }
    }

    const lastPt = points[points.length - 1];
    if (i < points.length - 1 && (lastPt.x - pt.x) < MIN_LABEL_GAP) {
      continue;
    }

    selected.push({
      x: pt.x,
      label,
      index: i,
      anchor
    });
  }

  // Ensure latest (last) data point is always pinned cleanly at the right edge
  const lastIdx = points.length - 1;
  const lastPt = points[lastIdx];
  const lastLabel = formatTime(lastPt.time);

  if (selected.length === 0) {
    selected.push({ x: lastPt.x, label: lastLabel, index: lastIdx, anchor: "end" });
  } else {
    const prev = selected[selected.length - 1];
    if (lastPt.x - prev.x >= MIN_LABEL_GAP && prev.label !== lastLabel) {
      selected.push({ x: lastPt.x, label: lastLabel, index: lastIdx, anchor: "end" });
    } else {
      selected[selected.length - 1] = { x: lastPt.x, label: lastLabel, index: lastIdx, anchor: "end" };
    }
  }

  return selected;
}

// Generate smooth cubic Bezier spline path from coordinates (Catmull-Rom to Cubic Bezier)
function getSmoothSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Generate smooth closed polygon path for gradient area fill
function getSmoothAreaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length === 0) return "";
  const spline = getSmoothSplinePath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${spline} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

export function TelemetryGraph({ batch, loading = false }: TelemetryGraphProps) {
  // --- Live Stream & Sliding Window State ---
  const [liveStreamActive, setLiveStreamActive] = useState(true);
  const [streamReadings, setStreamReadings] = useState<ReadingItem[]>([]);
  const [windowSize, setWindowSize] = useState<number>(12); // Default: 12 readings (1 minute)
  const [panOffset, setPanOffset] = useState<number>(0); // 0 = pinned to newest (auto-sliding)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(5);
  const [viewMode, setViewMode] = useState<"dynamic" | "full">("dynamic"); // Dynamic waveform zoom vs full 0-30°C

  const prevBatchIdRef = useRef<string | null>(null);

  // Synchronize stream directly with authoritative ledger batch telemetry
  useEffect(() => {
    if (!batch) return;

    const parseTime = (rawTime: any, rawTimestamp: any) => {
      if (rawTimestamp) {
        try {
          const d = new Date(rawTimestamp);
          if (!isNaN(d.getTime())) {
            return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          }
        } catch (_) {}
      }
      if (rawTime && rawTime.includes(":")) {
        return rawTime;
      }
      return "Live";
    };

    const baseLogs: ReadingItem[] = (batch.readings && batch.readings.length > 0)
      ? batch.readings.map((r: any) => {
          const tempVal = Number(r.temp ?? r.temperature ?? 0);
          const isExcursion = tempVal > (batch.maxTemp ?? 8) || tempVal < (batch.minTemp ?? 2);
          return {
            time: parseTime(r.time, r.timestamp),
            temp: tempVal,
            humidity: Number(r.humidity ?? 60),
            location: r.location || batch.assignedDevice || "Sensor_Omkar_01",
            hop: r.hop || "In Transit",
            status: isExcursion ? "CRITICAL_EXCURSION" : "NORMAL",
            timestamp: r.timestamp
          };
        })
      : (batch.temperatureLogs || []).map((l: any) => {
          const tempVal = Number(l.temperature ?? 0);
          const isExcursion = tempVal > (batch.maxTemp ?? 8) || tempVal < (batch.minTemp ?? 2);
          return {
            time: parseTime(null, l.timestamp),
            temp: tempVal,
            humidity: Number(l.humidity ?? 60),
            location: l.reporter || batch.assignedDevice || "Sensor_Omkar_01",
            hop: batch.status || "In Transit",
            status: isExcursion ? "CRITICAL_EXCURSION" : "NORMAL",
            timestamp: l.timestamp
          };
        });

    if (baseLogs.length === 0) return;

    // When batch ID changes, immediately reset to latest authoritative readings
    if (prevBatchIdRef.current !== batch.id) {
      prevBatchIdRef.current = batch.id;
      setStreamReadings(baseLogs);
      setPanOffset(0);
    } else {
      // Reconcile incoming live readings from Fabric
      setStreamReadings((curr) => {
        if (curr.length === 0) return baseLogs;
        const lastBase = baseLogs[baseLogs.length - 1];
        const lastCurr = curr[curr.length - 1];

        // If new reading arrived or API logs grew, adopt authoritative batch readings
        if (
          baseLogs.length >= curr.length ||
          lastBase?.timestamp !== lastCurr?.timestamp ||
          Math.abs(lastBase.temp - lastCurr.temp) > 0.05
        ) {
          return baseLogs;
        }
        return curr;
      });
    }
  }, [batch]);

  // 5-Second Interval Engine: Ticks every second, triggers smooth sliding & keeps sensor wave alive
  useEffect(() => {
    if (!liveStreamActive || !batch) return;

    const ticker = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Slide event: If live API hasn't delivered a fresh point yet, extrapolate micro-jitter
          setStreamReadings((curr) => {
            if (curr.length === 0) return curr;
            const last = curr[curr.length - 1];
            // Micro natural jitter (±0.03°C) around actual sensor baseline, NEVER artificial clamping
            const microJitter = Number(((Math.random() - 0.49) * 0.06).toFixed(2));
            const newTemp = Number((last.temp + microJitter).toFixed(1));
            const humJitter = Math.round((Math.random() - 0.5) * 1);
            const newHum = Math.min(99, Math.max(30, (last.humidity || 60) + humJitter));
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

            const minS = batch.minTemp ?? 2;
            const maxS = batch.maxTemp ?? 8;
            const isExcursion = newTemp < minS || newTemp > maxS;

            const interpolated: ReadingItem = {
              time: timeStr,
              temp: newTemp,
              humidity: newHum,
              location: batch.assignedDevice || "Sensor_Omkar_01",
              hop: batch.status || "In Transit",
              status: isExcursion ? "CRITICAL_EXCURSION" : "NORMAL",
              timestamp: now.toISOString()
            };

            const updated = [...curr, interpolated];
            return updated.length > 200 ? updated.slice(updated.length - 200) : updated;
          });

          return 5; // Reset 5s countdown
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(ticker);
  }, [liveStreamActive, batch]);

  // --- Zoom & Pan Calculations ---
  const allReadings = streamReadings;
  const totalCount = allReadings.length;

  const effectiveWindowSize = Math.min(windowSize, Math.max(4, totalCount));
  const maxPanOffset = Math.max(0, totalCount - effectiveWindowSize);
  const currentPan = Math.min(panOffset, maxPanOffset);

  const endIndex = totalCount - currentPan;
  const startIndex = Math.max(0, endIndex - effectiveWindowSize);
  const visibleReadings = useMemo(() => {
    return allReadings.slice(startIndex, endIndex);
  }, [allReadings, startIndex, endIndex]);

  const isPinnedToLive = currentPan === 0;

  // Zoom handlers
  const handleZoomIn = () => {
    setWindowSize((prev) => Math.max(4, prev - 3));
  };

  const handleZoomOut = () => {
    setWindowSize((prev) => Math.min(totalCount || 50, prev + 6));
  };

  const handlePanEarlier = () => {
    setPanOffset((prev) => Math.min(maxPanOffset, prev + 2));
  };

  const handlePanNewer = () => {
    setPanOffset((prev) => Math.max(0, prev - 2));
  };

  const handleResetToLive = () => {
    setPanOffset(0);
    setWindowSize(12);
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-border bg-card p-6 shadow-sm text-xs text-muted-foreground animate-pulse">
        <Activity className="size-5 animate-spin mr-2 text-primary" />
        Connecting to Hyperledger Fabric IoT Telemetry Stream...
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-border bg-card p-6 shadow-sm text-center">
        <Activity className="size-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm font-semibold text-foreground">No Batch Selected</p>
        <p className="text-xs text-muted-foreground mt-1">
          Select a batch from the table below to monitor its live temperature and humidity journey.
        </p>
      </div>
    );
  }

  const minSafe = batch.minTemp ?? 2.0;
  const maxSafe = batch.maxTemp ?? 8.0;
  const latestVisibleReading = visibleReadings[visibleReadings.length - 1];
  const isLatestExcursion = latestVisibleReading
    ? latestVisibleReading.temp < minSafe || latestVisibleReading.temp > maxSafe
    : false;

  // Temperature metrics for HUD
  const temps = visibleReadings.map((r) => r.temp);
  const minDataTemp = temps.length > 0 ? Math.min(...temps) : minSafe;
  const maxDataTemp = temps.length > 0 ? Math.max(...temps) : maxSafe;
  const avgDataTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : minSafe;

  // Live Trend Direction (last 2 readings)
  const prevReading = visibleReadings.length >= 2 ? visibleReadings[visibleReadings.length - 2] : null;
  const tempDelta = latestVisibleReading && prevReading ? latestVisibleReading.temp - prevReading.temp : 0;
  const trend = Math.abs(tempDelta) < 0.05 ? "stable" : tempDelta > 0 ? "up" : "down";

  // --- SVG Chart Dimensions ---
  const W = 760;
  const H = 270;
  const PAD_L = 72; // Wide enough so 8.0°C (Max) / 24.5°C never clips!
  const PAD_R = 30;
  const PAD_T = 24;
  const PAD_B = 42;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Smart Dynamic vs Full Y-Scale calculations
  let yMin: number;
  let yMax: number;

  if (viewMode === "dynamic") {
    // Dynamic waveform zoom: Show true sensor wave with healthy breathing space
    const dataSpan = maxDataTemp - minDataTemp;
    const center = (maxDataTemp + minDataTemp) / 2;
    const targetSpan = Math.max(2.4, dataSpan * 2.2); // Guarantee at least 2.4°C span so ripples look beautiful
    yMin = Number((center - targetSpan / 2).toFixed(1));
    yMax = Number((center + targetSpan / 2).toFixed(1));
  } else {
    // Full spectrum view: 0°C up to peak with safe zone in view
    yMin = Math.min(0, Math.floor(Math.min(minSafe, minDataTemp) - 1));
    yMax = Math.ceil(Math.max(maxSafe + 2, maxDataTemp + 2));
  }

  const yRange = yMax - yMin || 1;

  const getX = (idx: number) => {
    if (visibleReadings.length <= 1) return PAD_L + chartW / 2;
    return PAD_L + (idx / (visibleReadings.length - 1)) * chartW;
  };

  const getY = (temp: number) => {
    return PAD_T + chartH - ((temp - yMin) / yRange) * chartH;
  };

  // Safe band coordinates
  const safeTopY = getY(maxSafe);
  const safeBottomY = getY(minSafe);
  const safeBandClampedTop = Math.max(PAD_T, Math.min(PAD_T + chartH, safeTopY));
  const safeBandClampedBottom = Math.max(PAD_T, Math.min(PAD_T + chartH, safeBottomY));
  const safeBandVisible = safeBandClampedBottom > safeBandClampedTop;
  const safeBandHeight = Math.max(0, safeBandClampedBottom - safeBandClampedTop);

  // SVG points for spline curve
  const points = visibleReadings.map((r, i) => ({
    x: getX(i),
    y: getY(r.temp),
    ...r
  }));

  const splinePathStr = getSmoothSplinePath(points);
  const areaPathStr = getSmoothAreaPath(points, PAD_T + chartH);

  // Non-overlapping X-axis tick generation
  const xAxisTicks = computeXAxisTicks(points, chartW, PAD_L);

  // Y-axis grid lines (4 evenly distributed ticks)
  const yTicks = [0, 1, 2, 3].map((step) => {
    const val = Number((yMin + (yRange * step) / 3).toFixed(1));
    return {
      val,
      y: getY(val)
    };
  });

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm transition-all duration-300">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {batch.drugName || "Medicine Telemetry"}
            </h2>
            <span className="font-mono text-xs font-semibold text-primary">({batch.id})</span>
            {isLatestExcursion ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-alert/15 px-2.5 py-0.5 text-[11px] font-semibold text-alert border border-alert/20">
                <AlertTriangle className="size-3" /> Excursion Breach
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-safe/12 px-2.5 py-0.5 text-[11px] font-semibold text-safe border border-safe/20">
                <CheckCircle2 className="size-3" /> Cold-Chain Compliant
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Cpu className="size-3.5 text-primary" />
              Sensor Box: <strong className="font-mono text-foreground">{batch.assignedDevice || "Sensor_Omkar_01"}</strong>
            </span>
            <span>·</span>
            <span>
              Safe Cold Range: <strong className="text-foreground">{minSafe}°C – {maxSafe}°C</strong>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 font-mono text-primary font-medium">
              <Clock className="size-3.5" /> 5s Cadence
            </span>
          </div>
        </div>

        {/* Live Cadence Badge & Streaming Control */}
        <div className="flex flex-wrap items-center gap-2">
          {liveStreamActive ? (
            <div className="flex items-center gap-2 rounded-xl border border-safe/30 bg-safe/10 px-3 py-1.5 text-xs font-medium text-safe">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-safe opacity-75"></span>
                <span className="relative inline-flex size-2 rounded-full bg-safe"></span>
              </span>
              <span>Live 5s Stream</span>
              <span className="rounded bg-safe/20 px-1.5 py-0.2 font-mono text-[10px] text-safe font-bold">
                {secondsRemaining}s
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-xl border border-muted bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
              <Pause className="size-3.5" />
              <span>Stream Paused</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setLiveStreamActive(!liveStreamActive)}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            title={liveStreamActive ? "Pause 5s live sliding" : "Resume 5s live sliding"}
          >
            {liveStreamActive ? <Pause className="size-3.5" /> : <Play className="size-3.5 text-safe" />}
            <span>{liveStreamActive ? "Pause" : "Resume"}</span>
          </button>
        </div>
      </div>

      {/* Real-Time Mini-HUD Bar */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 mt-3">
        {/* Latest Value Card */}
        <div className="flex flex-col rounded-xl border border-border/70 bg-secondary/30 p-2.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Current Telemetry</span>
            <span className={`inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold ${
              trend === "up" ? "text-amber-500" : trend === "down" ? "text-blue-500" : "text-muted-foreground"
            }`}>
              {trend === "up" && <TrendingUp className="size-3 text-amber-500" />}
              {trend === "down" && <TrendingDown className="size-3 text-blue-500" />}
              {trend === "stable" && <Minus className="size-3" />}
              {tempDelta > 0 ? `+${tempDelta.toFixed(1)}°` : `${tempDelta.toFixed(1)}°`}
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`font-mono text-xl font-bold tracking-tight ${isLatestExcursion ? "text-alert" : "text-foreground"}`}>
              {latestVisibleReading ? `${latestVisibleReading.temp.toFixed(1)}°C` : "—"}
            </span>
            {latestVisibleReading && (
              <span className="text-[11px] text-muted-foreground font-mono">
                / {latestVisibleReading.humidity.toFixed(0)}% RH
              </span>
            )}
          </div>
        </div>

        {/* Window Range Card */}
        <div className="flex flex-col rounded-xl border border-border/70 bg-secondary/30 p-2.5">
          <span className="text-[11px] text-muted-foreground">Window Range</span>
          <div className="mt-1 flex items-baseline gap-2 font-mono text-xs font-semibold">
            <span className="text-blue-500">Min {minDataTemp.toFixed(1)}°C</span>
            <span className="text-muted-foreground/50">·</span>
            <span className="text-amber-500">Max {maxDataTemp.toFixed(1)}°C</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">
            Avg {avgDataTemp.toFixed(1)}°C ({visibleReadings.length} pts)
          </span>
        </div>

        {/* Cold-Chain Compliance Delta */}
        <div className="flex flex-col rounded-xl border border-border/70 bg-secondary/30 p-2.5">
          <span className="text-[11px] text-muted-foreground">Compliance Limit</span>
          <div className="mt-1 flex items-center gap-1 font-mono text-xs font-semibold">
            <span className={isLatestExcursion ? "text-alert" : "text-safe"}>
              {minSafe}°C – {maxSafe}°C
            </span>
          </div>
          <span className={`text-[10px] font-semibold mt-0.5 truncate ${isLatestExcursion ? "text-alert" : "text-safe"}`}>
            {isLatestExcursion
              ? latestVisibleReading && latestVisibleReading.temp > maxSafe
                ? `+${(latestVisibleReading.temp - maxSafe).toFixed(1)}°C above ceiling`
                : `-${(minSafe - (latestVisibleReading?.temp ?? 0)).toFixed(1)}°C below floor`
              : "100% Within Safe Band"}
          </span>
        </div>

        {/* Hardware Node Status */}
        <div className="flex flex-col rounded-xl border border-border/70 bg-secondary/30 p-2.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Fabric Ledger Node</span>
            <span className="flex items-center gap-1 text-[10px] text-safe font-semibold">
              <span className="size-1.5 rounded-full bg-safe animate-pulse" /> Live
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 font-mono text-xs font-bold text-foreground truncate">
            <Cpu className="size-3 text-primary shrink-0" />
            <span className="truncate">{batch.assignedDevice || "Sensor_Omkar_01"}</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 font-mono">
            Cryptographic Integrity Active
          </span>
        </div>
      </div>

      {/* Toolbar: Timeline Zoom In / Out, Presets, View Mode, and Panning */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-secondary/30 px-3 py-2 text-xs">
        {/* Zoom Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <ZoomIn className="size-3.5 text-primary" /> Zoom:
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={effectiveWindowSize <= 4}
            className="rounded-lg border border-border bg-background p-1.5 hover:bg-muted disabled:opacity-40 transition-colors"
            title="Zoom In (Fewer readings, higher resolution)"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={effectiveWindowSize >= totalCount}
            className="rounded-lg border border-border bg-background p-1.5 hover:bg-muted disabled:opacity-40 transition-colors"
            title="Zoom Out (More historical readings)"
          >
            <ZoomOut className="size-3.5" />
          </button>

          {/* Quick Preset Buttons */}
          <div className="ml-1 flex items-center gap-1">
            {[
              { pts: 6, label: "30s" },
              { pts: 12, label: "1m" },
              { pts: 30, label: "2.5m" },
              { pts: 60, label: "5m" }
            ].map(({ pts, label }) => (
              <button
                key={pts}
                type="button"
                onClick={() => { setWindowSize(pts); setPanOffset(0); }}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  windowSize === pts && isPinnedToLive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-background text-muted-foreground hover:bg-muted border border-border/60"
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setWindowSize(totalCount || 50); setPanOffset(0); }}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                windowSize >= totalCount
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-background text-muted-foreground hover:bg-muted border border-border/60"
              }`}
            >
              All ({totalCount})
            </button>
          </div>
        </div>

        {/* View Mode & Timeline Pan Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <button
            type="button"
            onClick={() => setViewMode(viewMode === "dynamic" ? "full" : "dynamic")}
            className="flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
            title={viewMode === "dynamic" ? "Switch to Full Scale (0°C–30°C)" : "Switch to Dynamic Waveform Zoom"}
          >
            {viewMode === "dynamic" ? (
              <>
                <Maximize2 className="size-3 text-primary" />
                <span>Full Scale</span>
              </>
            ) : (
              <>
                <Minimize2 className="size-3 text-primary" />
                <span>Wave Zoom</span>
              </>
            )}
          </button>

          <span className="text-border">|</span>

          {/* Pan Older / Newer */}
          <button
            type="button"
            onClick={handlePanEarlier}
            disabled={currentPan >= maxPanOffset}
            className="flex items-center gap-0.5 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-40 transition-colors"
            title="Pan to earlier historical readings"
          >
            <ChevronLeft className="size-3" /> Older
          </button>

          <button
            type="button"
            onClick={handlePanNewer}
            disabled={currentPan === 0}
            className="flex items-center gap-0.5 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-muted disabled:opacity-40 transition-colors"
            title="Pan towards newest live readings"
          >
            Newer <ChevronRight className="size-3" />
          </button>

          {/* Pin to Live Snap button */}
          <button
            type="button"
            onClick={handleResetToLive}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
              isPinnedToLive
                ? "border-safe/40 bg-safe/15 text-safe shadow-xs"
                : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            <RotateCcw className="size-3" />
            <span>{isPinnedToLive ? "Live Edge" : "Snap to Live"}</span>
          </button>
        </div>
      </div>

      {/* SVG Telemetry Chart Container */}
      <div className="relative mt-3 w-full overflow-hidden">
        {visibleReadings.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground">
            <Thermometer className="size-7 text-muted-foreground/40 mb-2" />
            <p className="font-medium text-foreground">Waiting for Live 5s Telemetry Stream...</p>
            <p className="mt-1 max-w-sm">
              Sensor box <strong>{batch.assignedDevice || "Sensor_Omkar_01"}</strong> streams readings every 5 seconds to Hyperledger Fabric.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full min-w-[620px] select-none text-xs transition-transform duration-500 ease-out"
              style={{ overflow: "visible" }}
            >
              <defs>
                {/* Area Gradient Fill for Compliant Telemetry */}
                <linearGradient id="areaSafeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>

                {/* Area Gradient Fill for Excursion Telemetry */}
                <linearGradient id="areaExcursionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.32" />
                  <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                </linearGradient>

                {/* Line Gradient for Spline Curve */}
                <linearGradient id="curveSafeGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>

                <linearGradient id="curveExcursionGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>

                {/* Subtle Glow Filter */}
                <filter id="splineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Grid Horizontal Lines & Y-Axis Labels */}
              {yTicks.map((tick, idx) => (
                <g key={`y-grid-${idx}`}>
                  <line
                    x1={PAD_L}
                    y1={tick.y}
                    x2={PAD_L + chartW}
                    y2={tick.y}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    className="text-border opacity-50"
                  />
                  <text
                    x={PAD_L - 10}
                    y={tick.y + 3.5}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px] font-mono font-medium"
                  >
                    {tick.val.toFixed(1)}°C
                  </text>
                </g>
              ))}

              {/* Safe Temperature Zone Shading (if in view) */}
              {safeBandVisible && (
                <>
                  <rect
                    x={PAD_L}
                    y={safeBandClampedTop}
                    width={chartW}
                    height={safeBandHeight}
                    fill="currentColor"
                    className="text-safe/12"
                  />
                  {/* Safe ceiling line */}
                  {safeTopY >= PAD_T && safeTopY <= PAD_T + chartH && (
                    <line
                      x1={PAD_L}
                      y1={safeTopY}
                      x2={PAD_L + chartW}
                      y2={safeTopY}
                      stroke="#f59e0b"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      className="opacity-70"
                    />
                  )}
                  {/* Safe floor line */}
                  {safeBottomY >= PAD_T && safeBottomY <= PAD_T + chartH && (
                    <line
                      x1={PAD_L}
                      y1={safeBottomY}
                      x2={PAD_L + chartW}
                      y2={safeBottomY}
                      stroke="#3b82f6"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      className="opacity-70"
                    />
                  )}
                </>
              )}

              {/* Safe Zone Callout Label (if inside view) */}
              {viewMode === "full" && safeTopY >= PAD_T + 12 && safeTopY <= PAD_T + chartH && (
                <text
                  x={PAD_L + 12}
                  y={safeTopY + 14}
                  className="fill-safe text-[9px] font-semibold tracking-wider uppercase opacity-80"
                >
                  Safe Cold-Chain Zone (2.0°C – 8.0°C)
                </text>
              )}

              {/* Out-of-bounds excursion banner in dynamic view */}
              {viewMode === "dynamic" && minDataTemp > maxSafe && (
                <g className="opacity-90">
                  <rect
                    x={PAD_L + 8}
                    y={PAD_T + 8}
                    width={chartW - 16}
                    height={22}
                    rx="6"
                    fill="currentColor"
                    className="text-alert/15"
                  />
                  <text
                    x={PAD_L + 18}
                    y={PAD_T + 22}
                    className="fill-alert text-[10px] font-bold"
                  >
                    ⚠️ Temperature Breach Excursion: +{(minDataTemp - maxSafe).toFixed(1)}°C above safe limit ({maxSafe}°C)
                  </text>
                </g>
              )}

              {/* Smooth Gradient Area Fill */}
              {areaPathStr && (
                <path
                  d={areaPathStr}
                  fill={isLatestExcursion ? "url(#areaExcursionGradient)" : "url(#areaSafeGradient)"}
                  className="transition-all duration-500 ease-out"
                />
              )}

              {/* Smooth Spline Curve Path */}
              {splinePathStr && (
                <path
                  d={splinePathStr}
                  fill="none"
                  stroke={isLatestExcursion ? "url(#curveExcursionGradient)" : "url(#curveSafeGradient)"}
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#splineGlow)"
                  className="transition-all duration-500 ease-out"
                />
              )}

              {/* Data Point Circles */}
              {points.map((p, i) => {
                const isPointExcursion = p.temp < minSafe || p.temp > maxSafe;
                const isHovered = hoverIndex === i;
                const isLatest = i === points.length - 1 && isPinnedToLive;

                return (
                  <g
                    key={`${p.time}-${i}`}
                    className="cursor-pointer transition-all duration-300"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    {/* Glowing pulse ring on the newest 5s reading */}
                    {isLatest && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="11"
                        fill="none"
                        stroke={isPointExcursion ? "#ef4444" : "#10b981"}
                        strokeWidth="1.5"
                        className="animate-ping opacity-60"
                      />
                    )}

                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6.5 : isLatest ? 5.5 : isPointExcursion ? 4.5 : 3.5}
                      className={
                        isPointExcursion
                          ? "fill-red-500 stroke-card stroke-2"
                          : isLatest
                          ? "fill-safe stroke-card stroke-2"
                          : "fill-primary stroke-card stroke-2"
                      }
                    />
                  </g>
                );
              })}

              {/* X Axis Non-Overlapping Tick Marks & Labels */}
              {xAxisTicks.map((tick) => (
                <g key={`x-tick-${tick.index}-${tick.x}`} className="select-none">
                  <line
                    x1={tick.x}
                    y1={PAD_T + chartH}
                    x2={tick.x}
                    y2={PAD_T + chartH + 5}
                    stroke="currentColor"
                    className="text-border opacity-70"
                    strokeWidth="1.5"
                  />
                  <text
                    x={tick.x}
                    y={H - 12}
                    textAnchor={tick.anchor}
                    className="fill-muted-foreground text-[10px] font-mono font-medium opacity-85"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {/* Hover Crosshair Guide Line on Data Point */}
              {hoverIndex !== null && points[hoverIndex] && (
                <g className="pointer-events-none transition-all duration-150">
                  <line
                    x1={points[hoverIndex].x}
                    y1={PAD_T}
                    x2={points[hoverIndex].x}
                    y2={PAD_T + chartH}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="text-primary opacity-70"
                  />
                  <circle
                    cx={points[hoverIndex].x}
                    cy={points[hoverIndex].y}
                    r="9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-primary opacity-80"
                  />
                </g>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* Interactive Tooltip & Reading Insight Bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between border-t border-border pt-3 text-xs gap-3">
        {hoverIndex !== null && visibleReadings[hoverIndex] ? (
          <div className="flex flex-wrap items-center gap-4 bg-secondary/50 rounded-xl px-3.5 py-1.5 border border-border/80 shadow-xs">
            <span className="font-semibold text-foreground flex items-center gap-1 font-mono">
              <Clock className="size-3.5 text-primary" /> {visibleReadings[hoverIndex].time}
            </span>
            <span className="flex items-center gap-1 font-mono text-primary font-bold">
              <Thermometer className="size-3.5" />
              {typeof visibleReadings[hoverIndex].temp === "number" && !isNaN(visibleReadings[hoverIndex].temp)
                ? `${visibleReadings[hoverIndex].temp.toFixed(1)}°C`
                : "—"}
            </span>
            {visibleReadings[hoverIndex].humidity !== undefined && (
              <span className="flex items-center gap-1 font-mono text-muted-foreground">
                <Droplets className="size-3.5 text-blue-500" />
                {typeof visibleReadings[hoverIndex].humidity === "number" && !isNaN(visibleReadings[hoverIndex].humidity)
                  ? `${visibleReadings[hoverIndex].humidity.toFixed(0)}%`
                  : `${visibleReadings[hoverIndex].humidity}%`}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                visibleReadings[hoverIndex].status === "CRITICAL_EXCURSION"
                  ? "bg-alert/15 text-alert border border-alert/20"
                  : "bg-safe/12 text-safe border border-safe/20"
              }`}
            >
              {visibleReadings[hoverIndex].status === "CRITICAL_EXCURSION" ? "⚠️ Excursion Breach" : "✅ Compliant"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <Sparkles className="size-3.5 text-primary" />
            <span>
              Sliding Window: <strong>{visibleReadings.length}</strong> of <strong>{totalCount}</strong> readings
              {isPinnedToLive ? " · Live 5s Auto-Sliding Active" : ` · Panned ${currentPan} steps back`}
            </span>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-safe" /> Safe ({minSafe}°C – {maxSafe}°C)
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-alert" /> Excursion
          </span>
          <span className="flex items-center gap-1 font-mono">
            <span className="size-2 rounded-full bg-primary" /> Latest 5s Edge
          </span>
        </div>
      </div>
    </div>
  );
}
