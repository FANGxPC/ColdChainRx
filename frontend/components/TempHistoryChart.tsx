"use client";

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine
} from 'recharts';
import {
  ShieldAlert,
  CheckCircle,
  Thermometer,
  Droplets,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Sparkles
} from 'lucide-react';

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isExcursion = data.status === 'CRITICAL_EXCURSION';
    const isWarning = data.status === 'WARNING';

    return (
      <div className={`rounded-xl border p-3 shadow-lg ${isExcursion ? 'border-destructive bg-destructive/10 text-destructive-foreground' : isWarning ? 'border-orange-500/50 bg-orange-500/10 text-orange-500' : 'border-border bg-card text-card-foreground'}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold">🕒 {label}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isExcursion ? 'bg-destructive text-destructive-foreground' : isWarning ? 'bg-orange-500 text-white' : 'bg-safe text-safe-foreground'}`}>
            {isExcursion ? '⚠️ CRITICAL BREACH' : isWarning ? '⚡ ELEVATED TEMP' : '✅ NORMAL'}
          </span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-1">
            <Thermometer className="size-3" /> <strong>Temperature:</strong> {typeof data?.temp === 'number' && !isNaN(data.temp) ? data.temp.toFixed(1) : (data?.temp ?? '—')}{unit}
          </p>
          <p className="flex items-center gap-1">
            <Droplets className="size-3" /> <strong>Humidity:</strong> {data.humidity}%
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>📍 Location:</strong> {data.location}
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>🚚 Stage:</strong> {data.hop}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

interface TempHistoryChartProps {
  batchData?: any;
  data?: any[];
  minTemp?: number;
  maxTemp?: number;
  unit?: string;
  isMockData?: boolean;
}

export default function TempHistoryChart({
  batchData,
  data,
  minTemp: propMinTemp,
  maxTemp: propMaxTemp,
  unit: propUnit,
  isMockData = false,
}: TempHistoryChartProps) {
  const [unit, setUnit] = useState(propUnit || '°C');
  const [showHumidity, setShowHumidity] = useState(false);
  const [windowSize, setWindowSize] = useState<number>(10);
  const [panOffset, setPanOffset] = useState<number>(0);

  const rawReadings = data || batchData?.readings || [];

  if (rawReadings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 border rounded-2xl bg-card text-muted-foreground">
        <Thermometer className="size-10 mb-2 opacity-50" />
        <p>No temperature history available for this batch.</p>
      </div>
    );
  }

  // Convert readings based on temperature unit toggle
  const formattedReadings = rawReadings.map((r: any) => {
    const rawVal = r.temp ?? r.temperature;
    const num = Number(rawVal);
    const validNum = !isNaN(num) ? num : 0;
    const tempVal = unit === '°F' ? (validNum * 9) / 5 + 32 : validNum;
    return {
      ...r,
      temp: tempVal,
      displayTemp: `${tempVal.toFixed(1)}${unit}`
    };
  });

  // Timeline Zoom & Pan calculations
  const totalReadings = formattedReadings.length;
  const effectiveWindowSize = Math.min(windowSize, Math.max(4, totalReadings));
  const maxPan = Math.max(0, totalReadings - effectiveWindowSize);
  const currentPan = Math.min(panOffset, maxPan);
  const endIndex = totalReadings - currentPan;
  const startIndex = Math.max(0, endIndex - effectiveWindowSize);
  const displayedReadings = formattedReadings.slice(startIndex, endIndex);
  const isPinnedToLive = currentPan === 0;

  const minThresholdRaw = propMinTemp ?? batchData?.requiredTempMin ?? batchData?.minTemp ?? 2;
  const maxThresholdRaw = propMaxTemp ?? batchData?.requiredTempMax ?? batchData?.maxTemp ?? 8;

  const minThreshold = unit === '°F' ? (minThresholdRaw * 9) / 5 + 32 : minThresholdRaw;
  const maxThreshold = unit === '°F' ? (maxThresholdRaw * 9) / 5 + 32 : maxThresholdRaw;

  const temps = displayedReadings.map((r: any) => r.temp);
  const minTemp = Math.min(...temps, minThreshold);
  const maxTemp = Math.max(...temps, maxThreshold);
  const domainMin = Math.floor(minTemp - (Math.abs(minTemp) * 0.15 || 3));
  const domainMax = Math.ceil(maxTemp + (Math.abs(maxTemp) * 0.15 || 3));

  const excursions = rawReadings.filter(
    (r: any) => r.status === 'CRITICAL_EXCURSION' || r.status === 'WARNING'
  );

  const storageLabel = batchData?.storageType || (minThresholdRaw < 0 ? `Ultra-Low Cryo Vault (${minThresholdRaw}°C to ${maxThresholdRaw}°C)` : `Cold Chain Storage (${minThresholdRaw}°C – ${maxThresholdRaw}°C)`);

  return (
    <div className="w-full rounded-3xl border border-white/60 bg-card p-4 sm:p-6 shadow-sm">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Thermometer className="size-5 text-primary" /> Cold-Chain Telemetry Log
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold bg-secondary text-secondary-foreground">{storageLabel}</span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold bg-primary/10 text-primary">
              <Clock className="size-3" /> 5s Cadence
            </span>
            {isMockData && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold bg-muted text-muted-foreground">Mock Data Preview</span>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${showHumidity ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
            onClick={() => setShowHumidity(!showHumidity)}
          >
            <Droplets className="size-4" /> <span className="hidden sm:inline">{showHumidity ? 'Hide Humidity' : 'Show Humidity'}</span><span className="sm:hidden">{showHumidity ? 'Hide' : 'Show'}</span>
          </button>

          <div className="inline-flex rounded-lg border p-1 bg-background">
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-xs sm:text-sm font-medium transition-colors ${unit === '°C' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
              onClick={() => setUnit('°C')}
            >
              °C
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-xs sm:text-sm font-medium transition-colors ${unit === '°F' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/50'}`}
              onClick={() => setUnit('°F')}
            >
              °F
            </button>
          </div>
        </div>
      </div>

      {/* Excursion Banner */}
      {excursions.length > 0 ? (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive-foreground">
          <ShieldAlert className="size-5 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm font-semibold">Thermal Excursion Detected!</strong>
            <span className="text-sm"> {excursions.length} temperature reading(s) breached allowed safe threshold ({minThresholdRaw}{unit} to {maxThresholdRaw}{unit}).</span>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-safe/50 bg-safe/10 p-4 text-safe-foreground">
          <CheckCircle className="size-5 shrink-0 mt-0.5" />
          <span className="text-sm"><strong>Cold-chain integrity verified:</strong> All readings maintained within safe bounds ({minThresholdRaw}{unit} to {maxThresholdRaw}{unit}).</span>
        </div>
      )}

      {/* Toolbar: Timeline Zoom In / Out & Pan Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/30 px-3 py-2 text-xs">
        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <ZoomIn className="size-3.5 text-primary" /> Zoom:
          </span>
          <button
            type="button"
            onClick={() => setWindowSize((prev) => Math.max(4, prev - 3))}
            disabled={effectiveWindowSize <= 4}
            className="rounded-lg border border-border bg-background p-1.5 hover:bg-muted disabled:opacity-40 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setWindowSize((prev) => Math.min(totalReadings, prev + 5))}
            disabled={effectiveWindowSize >= totalReadings}
            className="rounded-lg border border-border bg-background p-1.5 hover:bg-muted disabled:opacity-40 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="size-3.5" />
          </button>

          {/* Quick Presets */}
          <div className="ml-2 flex items-center gap-1">
            {[5, 10, 25].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => { setWindowSize(preset); setPanOffset(0); }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  windowSize === preset && isPinnedToLive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {preset * 5}s ({preset} pts)
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setWindowSize(totalReadings); setPanOffset(0); }}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                windowSize >= totalReadings
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Timeline Pan Controls */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="size-3.5 text-primary" /> Timeline:
          </span>

          <button
            type="button"
            onClick={() => setPanOffset((prev) => Math.min(maxPan, prev + 2))}
            disabled={currentPan >= maxPan}
            className="flex items-center gap-0.5 rounded-lg border border-border bg-background px-2 py-0.5 text-[11px] font-medium hover:bg-muted disabled:opacity-40 transition-colors"
            title="Pan to earlier readings"
          >
            <ChevronLeft className="size-3" /> Older
          </button>

          <button
            type="button"
            onClick={() => setPanOffset((prev) => Math.max(0, prev - 2))}
            disabled={currentPan === 0}
            className="flex items-center gap-0.5 rounded-lg border border-border bg-background px-2 py-0.5 text-[11px] font-medium hover:bg-muted disabled:opacity-40 transition-colors"
            title="Pan towards newest live readings"
          >
            Newer <ChevronRight className="size-3" />
          </button>

          <button
            type="button"
            onClick={() => { setPanOffset(0); setWindowSize(10); }}
            className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-all ${
              isPinnedToLive
                ? "border-safe/40 bg-safe/15 text-safe"
                : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            }`}
          >
            <RotateCcw className="size-3" />
            <span>{isPinnedToLive ? "Live Edge" : "Snap to Live"}</span>
          </button>
        </div>
      </div>

      {/* Main Recharts Container */}
      <div className="h-[320px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayedReadings} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
            <XAxis
              dataKey="time"
              stroke="currentColor"
              className="text-[10px] sm:text-xs opacity-60 font-mono"
              tick={{ fill: 'currentColor' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={45}
            />
            <YAxis
              yAxisId="temp"
              domain={[domainMin, domainMax]}
              stroke="currentColor"
              className="text-[10px] sm:text-xs opacity-50"
              tick={{ fill: 'currentColor' }}
              tickLine={false}
              axisLine={false}
              unit={unit}
            />
            {showHumidity && (
              <YAxis
                yAxisId="humidity"
                orientation="right"
                domain={[0, 100]}
                stroke="#38bdf8"
                className="text-[10px] sm:text-xs"
                tick={{ fill: '#38bdf8' }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
            )}
            <Tooltip content={<CustomTooltip unit={unit} />} />
            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />

            <ReferenceArea
              yAxisId="temp"
              y1={minThreshold}
              y2={maxThreshold}
              fill="#10b981"
              fillOpacity={0.1}
              stroke="none"
            />

            <ReferenceLine yAxisId="temp" y={maxThreshold} stroke="#f59e0b" strokeDasharray="4 4" />
            <ReferenceLine yAxisId="temp" y={minThreshold} stroke="#3b82f6" strokeDasharray="4 4" />

            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              name={`Temperature (${unit})`}
              stroke="#38bdf8"
              strokeWidth={3}
              isAnimationActive={true}
              animationDuration={500}
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                const isLatest = index === displayedReadings.length - 1 && isPinnedToLive;
                if (payload.status === 'CRITICAL_EXCURSION') {
                  return <circle key={cx} cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />;
                }
                if (payload.status === 'WARNING') {
                  return <circle key={cx} cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />;
                }
                return (
                  <circle
                    key={cx}
                    cx={cx}
                    cy={cy}
                    r={isLatest ? 5.5 : 4}
                    fill={isLatest ? "#10b981" : "#0284c7"}
                    stroke={isLatest ? "#ffffff" : "none"}
                    strokeWidth={isLatest ? 2 : 0}
                  />
                );
              }}
              activeDot={{ r: 6, stroke: '#ffffff', strokeWidth: 2 }}
            />

            {showHumidity && (
              <Line
                yAxisId="humidity"
                type="monotone"
                dataKey="humidity"
                name="Humidity (%)"
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={{ r: 2 }}
                isAnimationActive={true}
                animationDuration={500}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Info */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-2">
        <span className="flex items-center gap-1">
          <Sparkles className="size-3 text-primary" />
          Viewing <strong>{displayedReadings.length}</strong> of <strong>{totalReadings}</strong> readings
          {isPinnedToLive ? " · Live 5s Sliding Active" : ` · Panned ${currentPan} points back`}
        </span>
        <span>Sampling interval: 5 seconds</span>
      </div>
    </div>
  );
}
