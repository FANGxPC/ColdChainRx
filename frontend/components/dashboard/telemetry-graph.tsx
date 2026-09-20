"use client"

import { useMemo, useState } from "react"
import { Activity } from "lucide-react"
import { telemetrySeries, SAFE_MIN, SAFE_MAX } from "@/lib/mock-data"

const W = 760
const H = 280
const PAD_L = 34
const PAD_R = 16
const PAD_T = 16
const PAD_B = 28

export function TelemetryGraph() {
  const { labels, lines } = telemetrySeries
  const [hover, setHover] = useState<number | null>(null)

  const { domainMin, domainMax } = useMemo(() => {
    const all = lines.flatMap((l) => l.values)
    return {
      domainMin: Math.min(SAFE_MIN - 1, ...all),
      domainMax: Math.max(SAFE_MAX + 2, ...all),
    }
  }, [lines])
  const range = domainMax - domainMin || 1

  const x = (i: number) => PAD_L + (i / (labels.length - 1)) * (W - PAD_L - PAD_R)
  const y = (v: number) => PAD_T + (1 - (v - domainMin) / range) * (H - PAD_T - PAD_B)

  const ticks = [domainMin, (domainMin + domainMax) / 2, SAFE_MAX, domainMax].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  )

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Real-Time Telemetry</h2>
            <p className="text-xs text-muted-foreground">Live temperature across active shipments (°C)</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lines.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ background: l.color }} />
              {l.id}
            </span>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Real-time temperature telemetry across active shipments"
        onMouseLeave={() => setHover(null)}
      >
        {/* Safe band */}
        <rect
          x={PAD_L}
          y={y(SAFE_MAX)}
          width={W - PAD_L - PAD_R}
          height={Math.max(0, y(SAFE_MIN) - y(SAFE_MAX))}
          fill="var(--safe)"
          opacity="0.08"
        />
        <line x1={PAD_L} y1={y(SAFE_MAX)} x2={W - PAD_R} y2={y(SAFE_MAX)} stroke="var(--safe)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        <line x1={PAD_L} y1={y(SAFE_MIN)} x2={W - PAD_R} y2={y(SAFE_MIN)} stroke="var(--safe)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

        {/* Y ticks */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={y(v)} x2={W - PAD_R} y2={y(v)} stroke="var(--border)" strokeWidth="1" opacity="0.5" />
            <text x={PAD_L - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground" fontSize="9">
              {v.toFixed(0)}
            </text>
          </g>
        ))}

        {/* X labels (every 4th) */}
        {labels.map((lab, i) =>
          i % 4 === 0 ? (
            <text key={lab} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
              {lab}
            </text>
          ) : null,
        )}

        {/* Lines */}
        {lines.map((l) => {
          const d = l.values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
          return (
            <path
              key={l.id}
              d={d}
              fill="none"
              stroke={l.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-draw"
              style={{ strokeDasharray: 2000, ["--dash" as string]: "2000" }}
            />
          )
        })}

        {/* Hover interaction */}
        {labels.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W - PAD_L - PAD_R) / labels.length / 2}
            y={PAD_T}
            width={(W - PAD_L - PAD_R) / labels.length}
            height={H - PAD_T - PAD_B}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover !== null && (
          <g>
            <line x1={x(hover)} y1={PAD_T} x2={x(hover)} y2={H - PAD_B} stroke="var(--foreground)" strokeWidth="1" opacity="0.2" />
            {lines.map((l) => (
              <circle key={l.id} cx={x(hover)} cy={y(l.values[hover])} r="3.5" fill={l.color} stroke="var(--card)" strokeWidth="1.5" />
            ))}
          </g>
        )}
      </svg>

      {hover !== null && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-secondary/60 px-3 py-2 text-xs">
          <span className="font-medium text-foreground">{labels[hover]}</span>
          {lines.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: l.color }} />
              <span className="font-mono">{l.values[hover].toFixed(1)}°C</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
