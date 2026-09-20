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
import { AlertTriangle, CheckCircle, ShieldAlert, Thermometer, Droplets } from 'lucide-react';
import './TempHistoryChart.css';

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isExcursion = data.status === 'CRITICAL_EXCURSION';
    const isWarning = data.status === 'WARNING';

    return (
      <div className={`chart-tooltip-card ${isExcursion ? 'tooltip-excursion' : isWarning ? 'tooltip-warning' : ''}`}>
        <div className="tooltip-header">
          <span className="tooltip-time">🕒 {label}</span>
          <span className={`tooltip-badge badge-${data.status.toLowerCase()}`}>
            {isExcursion ? '⚠️ CRITICAL BREACH' : isWarning ? '⚡ ELEVATED TEMP' : '✅ NORMAL'}
          </span>
        </div>
        <div className="tooltip-body">
          <p className="tooltip-item">
            <Thermometer className="icon-sm" /> <strong>Temperature:</strong> {data.temp.toFixed(1)}{unit}
          </p>
          <p className="tooltip-item">
            <Droplets className="icon-sm" /> <strong>Humidity:</strong> {data.humidity}%
          </p>
          <p className="tooltip-item">
            <strong>📍 Location:</strong> {data.location}
          </p>
          <p className="tooltip-item">
            <strong>🚚 Stage:</strong> {data.hop}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export default function TempHistoryChart({ batchData, isMockData = true }) {
  const [unit, setUnit] = useState('°C');
  const [showHumidity, setShowHumidity] = useState(false);

  if (!batchData || !batchData.readings || batchData.readings.length === 0) {
    return (
      <div className="chart-empty-state">
        <Thermometer className="empty-icon" />
        <p>No temperature history available for this batch.</p>
      </div>
    );
  }

  // Convert readings based on temperature unit toggle
  const formattedReadings = batchData.readings.map((r) => {
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

  // Calculate domain min/max with padding
  const temps = formattedReadings.map((r) => r.temp);
  const minTemp = Math.min(...temps, minThreshold);
  const maxTemp = Math.max(...temps, maxThreshold);
  const domainMin = Math.floor(minTemp - (Math.abs(minTemp) * 0.15 || 3));
  const domainMax = Math.ceil(maxTemp + (Math.abs(maxTemp) * 0.15 || 3));

  const excursions = batchData.readings.filter(
    (r) => r.status === 'CRITICAL_EXCURSION' || r.status === 'WARNING'
  );

  return (
    <div className="temp-chart-container">
      <div className="chart-header">
        <div className="chart-title-group">
          <h3>
            <Thermometer className="title-icon" /> Cold-Chain Telemetry Log
          </h3>
          <span className="storage-badge">{batchData.storageType}</span>
          {isMockData && <span className="mock-badge">Sadique Component Preview (Mock Data)</span>}
        </div>

        <div className="chart-controls">
          <button
            type="button"
            className={`btn-toggle ${showHumidity ? 'active' : ''}`}
            onClick={() => setShowHumidity(!showHumidity)}
          >
            <Droplets className="btn-icon" /> {showHumidity ? 'Hide Humidity' : 'Show Humidity'}
          </button>

          <div className="unit-toggle-group">
            <button
              type="button"
              className={`btn-unit ${unit === '°C' ? 'active' : ''}`}
              onClick={() => setUnit('°C')}
            >
              °C
            </button>
            <button
              type="button"
              className={`btn-unit ${unit === '°F' ? 'active' : ''}`}
              onClick={() => setUnit('°F')}
            >
              °F
            </button>
          </div>
        </div>
      </div>

      {excursions.length > 0 ? (
        <div className="excursion-alert-banner">
          <ShieldAlert className="alert-banner-icon" />
          <div>
            <strong>Thermal Excursion Detected!</strong>
            <span> {excursions.length} temperature reading(s) breached allowed safe threshold ({minThresholdRaw}{batchData.unit} to {maxThresholdRaw}{batchData.unit}).</span>
          </div>
        </div>
      ) : (
        <div className="integrity-pass-banner">
          <CheckCircle className="pass-banner-icon" />
          <span>Cold-chain integrity verified: All readings maintained within safe bounds ({minThresholdRaw}{batchData.unit} to {maxThresholdRaw}{batchData.unit}).</span>
        </div>
      )}

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={formattedReadings} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
            <XAxis dataKey="time" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis
              yAxisId="temp"
              domain={[domainMin, domainMax]}
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              unit={unit}
            />
            {showHumidity && (
              <YAxis
                yAxisId="humidity"
                orientation="right"
                domain={[0, 100]}
                stroke="#38bdf8"
                tick={{ fill: '#38bdf8', fontSize: 12 }}
                unit="%"
              />
            )}
            <Tooltip content={<CustomTooltip unit={unit} />} />
            <Legend verticalAlign="top" height={36} />

            {/* Safe Temperature Band */}
            <ReferenceArea
              yAxisId="temp"
              y1={minThreshold}
              y2={maxThreshold}
              fill="#10b981"
              fillOpacity={0.12}
              stroke="none"
              label={{ value: `Safe Operating Range (${minThresholdRaw}${batchData.unit} - ${maxThresholdRaw}${batchData.unit})`, fill: '#10b981', position: 'insideTopLeft', fontSize: 11 }}
            />

            {/* Threshold boundaries */}
            <ReferenceLine yAxisId="temp" y={maxThreshold} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `Max Safe: ${maxThreshold.toFixed(1)}${unit}`, fill: '#f59e0b', fontSize: 10, position: 'top' }} />
            <ReferenceLine yAxisId="temp" y={minThreshold} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: `Min Safe: ${minThreshold.toFixed(1)}${unit}`, fill: '#3b82f6', fontSize: 10, position: 'bottom' }} />

            {/* Temperature Line */}
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              name={`Temperature (${unit})`}
              stroke="#38bdf8"
              strokeWidth={3}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.status === 'CRITICAL_EXCURSION') {
                  return (
                    <circle key={cx} cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
                  );
                }
                if (payload.status === 'WARNING') {
                  return (
                    <circle key={cx} cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />
                  );
                }
                return <circle key={cx} cx={cx} cy={cy} r={3} fill="#0284c7" />;
              }}
              activeDot={{ r: 8, stroke: '#ffffff', strokeWidth: 2 }}
            />

            {/* Optional Humidity Line */}
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

      <div className="chart-legend-footer">
        <span className="legend-item"><span className="dot dot-normal"></span> Normal Reading</span>
        <span className="legend-item"><span className="dot dot-warning"></span> Warning Threshold</span>
        <span className="legend-item"><span className="dot dot-excursion"></span> Critical Excursion</span>
        <span className="legend-item"><span className="band-sample"></span> Safe Band</span>
      </div>
    </div>
  );
}
