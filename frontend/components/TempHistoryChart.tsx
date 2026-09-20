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
import { ShieldAlert, CheckCircle, Thermometer, Droplets } from 'lucide-react';

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
            <Thermometer className="size-3" /> <strong>Temperature:</strong> {data.temp.toFixed(1)}{unit}
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

export default function TempHistoryChart({ batchData, isMockData = true }: { batchData: any, isMockData?: boolean }) {
  const [unit, setUnit] = useState('°C');
  const [showHumidity, setShowHumidity] = useState(false);

  if (!batchData || !batchData.readings || batchData.readings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 border rounded-2xl bg-card text-muted-foreground">
        <Thermometer className="size-10 mb-2 opacity-50" />
        <p>No temperature history available for this batch.</p>
      </div>
    );
  }

  // Convert readings based on temperature unit toggle
  const formattedReadings = batchData.readings.map((r: any) => {
    const tempVal = unit === '°F' ? (r.temp * 9) / 5 + 32 : r.temp;
    return {
      ...r,
      temp: tempVal,
      displayTemp: `${tempVal.toFixed(1)}${unit}`
    };
  });

  const minThresholdRaw = batchData.requiredTempMin;
  const maxThresholdRaw = batchData.requiredTempMax;

  const minThreshold = unit === '°F' ? (minThresholdRaw * 9) / 5 + 32 : minThresholdRaw;
  const maxThreshold = unit === '°F' ? (maxThresholdRaw * 9) / 5 + 32 : maxThresholdRaw;

  const temps = formattedReadings.map((r: any) => r.temp);
  const minTemp = Math.min(...temps, minThreshold);
  const maxTemp = Math.max(...temps, maxThreshold);
  const domainMin = Math.floor(minTemp - (Math.abs(minTemp) * 0.15 || 3));
  const domainMax = Math.ceil(maxTemp + (Math.abs(maxTemp) * 0.15 || 3));

  const excursions = batchData.readings.filter(
    (r: any) => r.status === 'CRITICAL_EXCURSION' || r.status === 'WARNING'
  );

  return (
    <div className="w-full rounded-3xl border border-white/60 bg-card p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Thermometer className="size-5 text-primary" /> Cold-Chain Telemetry Log
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold bg-secondary text-secondary-foreground">{batchData.storageType}</span>
            {isMockData && <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold bg-muted text-muted-foreground">Mock Data Preview</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {excursions.length > 0 ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-destructive-foreground">
          <ShieldAlert className="size-5 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm font-semibold">Thermal Excursion Detected!</strong>
            <span className="text-sm"> {excursions.length} temperature reading(s) breached allowed safe threshold ({minThresholdRaw}{batchData.unit} to {maxThresholdRaw}{batchData.unit}).</span>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-safe/50 bg-safe/10 p-4 text-safe-foreground">
          <CheckCircle className="size-5 shrink-0 mt-0.5" />
          <span className="text-sm"><strong>Cold-chain integrity verified:</strong> All readings maintained within safe bounds ({minThresholdRaw}{batchData.unit} to {maxThresholdRaw}{batchData.unit}).</span>
        </div>
      )}

      <div className="h-[320px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formattedReadings} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
            <XAxis dataKey="time" stroke="currentColor" className="text-[10px] sm:text-xs opacity-50" tick={{ fill: 'currentColor' }} tickLine={false} axisLine={false} />
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
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.status === 'CRITICAL_EXCURSION') {
                  return <circle key={cx} cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />;
                }
                if (payload.status === 'WARNING') {
                  return <circle key={cx} cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />;
                }
                return <circle key={cx} cx={cx} cy={cy} r={4} fill="#0284c7" />;
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
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
