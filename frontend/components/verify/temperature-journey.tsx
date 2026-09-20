"use client"

import { useId } from "react"
import type { TempPoint } from "@/lib/mock-data"

type Props = {
  data: TempPoint[]
  minSafe: number
  maxSafe: number
}

const W = 320
const H = 120
const PAD_X = 8
const PAD_Y = 14

export function TemperatureJourney({ data, minSafe, maxSafe }: Props) {
  const gradId = useId()
  const clipId = useId()

  const temps = data.map((d) => d.temp)
  const domainMin = Math.min(minSafe - 1, ...temps)
  const domainMax = Math.max(maxSafe + 1, ...temps)
  const range = domainMax - domainMin || 1

  const x = (i: number) => PAD_X + (i / (data.length - 1)) * (W - PAD_X * 2)
  const y = (v: number) => PAD_Y + (1 - (v - domainMin) / range) * (H - PAD_Y * 2)

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.temp).toFixed(1)}`).join(" ")
  const areaPath = `${linePath} L ${x(data.length - 1).toFixed(1)} ${H - PAD_Y} L ${x(0).toFixed(1)} ${H - PAD_Y} Z`

  const safeTop = y(maxSafe)
  const safeBottom = y(minSafe)
  const peak = Math.max(...temps)
  const withinRange = peak <= maxSafe && Math.min(...temps) >= minSafe

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Temperature journey ranging from ${Math.min(...temps)} to ${peak} degrees Celsius, staying within the ${minSafe} to ${maxSafe} degree safe range`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--safe)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--safe)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
        </defs>

        {/* Safe band */}
        <rect
          x={PAD_X}
          y={safeTop}
          width={W - PAD_X * 2}
          height={Math.max(0, safeBottom - safeTop)}
          fill="var(--safe)"
          opacity="0.1"
          rx="4"
        />
        <line x1={PAD_X} y1={safeTop} x2={W - PAD_X} y2={safeTop} stroke="var(--safe)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
        <line x1={PAD_X} y1={safeBottom} x2={W - PAD_X} y2={safeBottom} stroke="var(--safe)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

        <g clipPath={`url(#${clipId})`}>
          <path d={areaPath} fill={`url(#${gradId})`} />
          <path
            d={linePath}
            fill="none"
            stroke={withinRange ? "var(--safe)" : "var(--alert)"}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-draw"
            style={{ strokeDasharray: 1000, ["--dash" as string]: "1000" }}
          />
        </g>

        {/* End marker */}
        <circle
          cx={x(data.length - 1)}
          cy={y(data[data.length - 1].temp)}
          r="4"
          fill="var(--safe)"
          stroke="var(--card)"
          strokeWidth="2"
        />
      </svg>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Dispatch</span>
        <span className="font-medium text-safe">Safe window {minSafe}°C – {maxSafe}°C</span>
        <span>Now</span>
      </div>
    </div>
  )
}
