export type BatchStatus = "authentic" | "breach"
export type MlStatus = "normal" | "anomaly"
export type SyncStatus = "synced" | "pending" | "syncing"

export type TempPoint = {
  /** hours since dispatch */
  t: number
  label: string
  temp: number
}

export type Batch = {
  id: string
  drug: string
  manufacturer: string
  expiry: string
  location: string
  liveTemp: number
  status: BatchStatus
  ml: MlStatus
  sync: SyncStatus
  anomalies: number
  txHash: string
  blockHeight: number
  verifiedAt: string
  minSafe: number
  maxSafe: number
  journey: TempPoint[]
}

/** Safe cold-chain window for most mRNA / protein vaccines */
export const SAFE_MIN = 2
export const SAFE_MAX = 8

function series(points: number[]): TempPoint[] {
  return points.map((temp, i) => ({
    t: i * 4,
    label: `${String(i * 4).padStart(2, "0")}:00`,
    temp,
  }))
}

export const consumerBatch: Batch = {
  id: "VX-2847-A19",
  drug: "ImmunoGuard mRNA-1273",
  manufacturer: "Helix Biologics",
  expiry: "2027-03-14",
  location: "St. Mary's Regional Pharmacy, Boston MA",
  liveTemp: 4.6,
  status: "authentic",
  ml: "normal",
  sync: "synced",
  anomalies: 0,
  txHash: "0x7f3a9c2e8b41d6f0a5c92e17b4d83fa6c1e0927d",
  blockHeight: 18_492_017,
  verifiedAt: "2026-09-20T09:42:11Z",
  minSafe: SAFE_MIN,
  maxSafe: SAFE_MAX,
  journey: series([5.1, 4.8, 4.2, 3.9, 4.4, 5.0, 4.7, 4.1, 3.8, 4.3, 4.9, 4.6]),
}

export const batches: Batch[] = [
  consumerBatch,
  {
    id: "VX-2851-C04",
    drug: "NeoVax Pediatric",
    manufacturer: "Cerulean Pharma",
    expiry: "2026-12-01",
    location: "In transit — I-90 near Albany, NY",
    liveTemp: 6.9,
    status: "authentic",
    ml: "normal",
    sync: "syncing",
    anomalies: 0,
    txHash: "0x2b81f0a4c7e93d5182a6f4b0d7c39e1a8452fd60",
    blockHeight: 18_492_004,
    verifiedAt: "2026-09-20T09:38:02Z",
    minSafe: SAFE_MIN,
    maxSafe: SAFE_MAX,
    journey: series([4.9, 5.4, 6.0, 6.4, 6.1, 5.8, 6.5, 6.9, 6.7, 6.2, 6.8, 6.9]),
  },
  {
    id: "VX-2839-B77",
    drug: "ImmunoGuard mRNA-1273",
    manufacturer: "Helix Biologics",
    expiry: "2027-01-22",
    location: "Cold Hub Distribution, Newark NJ",
    liveTemp: 11.3,
    status: "breach",
    ml: "anomaly",
    sync: "synced",
    anomalies: 3,
    txHash: "0x9d47e2b1a0f83c65d219704ba8e5cf3120d6a794",
    blockHeight: 18_491_988,
    verifiedAt: "2026-09-20T09:20:47Z",
    minSafe: SAFE_MIN,
    maxSafe: SAFE_MAX,
    journey: series([4.7, 5.0, 5.3, 7.1, 9.4, 11.8, 12.2, 10.6, 9.1, 10.3, 11.0, 11.3]),
  },
  {
    id: "VX-2860-D12",
    drug: "RheoShield IV",
    manufacturer: "Aster Therapeutics",
    expiry: "2026-11-09",
    location: "In transit — Logan Airport Cargo, Boston MA",
    liveTemp: 3.4,
    status: "authentic",
    ml: "normal",
    sync: "pending",
    anomalies: 0,
    txHash: "0x4c0a7f9e21b8d3650a1f7c4e9d2d05a83e17f6c2",
    blockHeight: 18_491_960,
    verifiedAt: "2026-09-20T09:11:33Z",
    minSafe: SAFE_MIN,
    maxSafe: SAFE_MAX,
    journey: series([2.8, 3.1, 3.5, 3.2, 2.9, 3.4, 3.6, 3.3, 3.0, 3.5, 3.2, 3.4]),
  },
  {
    id: "VX-2842-E58",
    drug: "NeoVax Pediatric",
    manufacturer: "Cerulean Pharma",
    expiry: "2027-02-18",
    location: "Warehouse 4B, Providence RI",
    liveTemp: 5.7,
    status: "authentic",
    ml: "normal",
    sync: "synced",
    anomalies: 0,
    txHash: "0x1e6b90d3f27a4c8501bd63e9a7f240c5981ea3b7",
    blockHeight: 18_491_921,
    verifiedAt: "2026-09-20T08:57:19Z",
    minSafe: SAFE_MIN,
    maxSafe: SAFE_MAX,
    journey: series([5.2, 5.5, 5.9, 5.6, 5.3, 5.8, 6.0, 5.7, 5.4, 5.9, 5.6, 5.7]),
  },
]

export type MetricCard = {
  label: string
  value: string
  delta: string
  trend: "up" | "down" | "flat"
  tone: "brand" | "safe" | "alert" | "warn"
}

export const metrics: MetricCard[] = [
  { label: "Total Active Batches", value: "1,284", delta: "+42 today", trend: "up", tone: "brand" },
  { label: "Breaches · 24h", value: "3", delta: "+1 vs. yesterday", trend: "up", tone: "alert" },
  { label: "IoT Sensor Uptime", value: "99.7%", delta: "+0.2%", trend: "up", tone: "safe" },
  { label: "Network Nodes Active", value: "48 / 48", delta: "All synced", trend: "flat", tone: "warn" },
]

export type Alert = {
  id: string
  batch: string
  sensor: string
  message: string
  severity: "critical" | "warning" | "info"
  time: string
  event: string
}

export const alerts: Alert[] = [
  {
    id: "a1",
    batch: "VX-2839-B77",
    sensor: "ESP32-0x4F",
    message: "Temperature spike to 12.2°C — exceeded 8°C ceiling for 6m",
    severity: "critical",
    time: "2m ago",
    event: "BreachRecorded()",
  },
  {
    id: "a2",
    batch: "VX-2851-C04",
    sensor: "ESP32-0x1A",
    message: "Approaching upper bound (6.9°C) during airport transfer",
    severity: "warning",
    time: "14m ago",
    event: "ThresholdWarning()",
  },
  {
    id: "a3",
    batch: "VX-2860-D12",
    sensor: "ESP32-0x77",
    message: "Ledger sync pending — awaiting node consensus",
    severity: "info",
    time: "21m ago",
    event: "SyncQueued()",
  },
  {
    id: "a4",
    batch: "VX-2839-B77",
    sensor: "ESP32-0x4F",
    message: "Isolation Forest flagged anomaly cluster (score 0.87)",
    severity: "critical",
    time: "24m ago",
    event: "AnomalyDetected()",
  },
  {
    id: "a5",
    batch: "VX-2847-A19",
    sensor: "ESP32-0x2C",
    message: "Handoff verified at St. Mary's Regional Pharmacy",
    severity: "info",
    time: "38m ago",
    event: "CustodyTransfer()",
  },
]

/** Multi-shipment live telemetry for the dashboard graph */
export const telemetrySeries = {
  labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`),
  lines: [
    {
      id: "VX-2847-A19",
      color: "var(--chart-1)",
      values: [5.1, 4.8, 4.2, 3.9, 4.4, 5.0, 4.7, 4.1, 3.8, 4.3, 4.9, 4.6, 4.2, 4.5, 4.8, 4.4, 4.0, 4.3, 4.7, 4.5, 4.1, 4.4, 4.8, 4.6],
    },
    {
      id: "VX-2851-C04",
      color: "var(--chart-3)",
      values: [4.9, 5.4, 6.0, 6.4, 6.1, 5.8, 6.5, 6.9, 6.7, 6.2, 6.8, 6.9, 6.4, 6.1, 6.6, 6.9, 6.7, 6.3, 6.8, 6.5, 6.2, 6.7, 6.9, 6.8],
    },
    {
      id: "VX-2839-B77",
      color: "var(--chart-5)",
      values: [4.7, 5.0, 5.3, 7.1, 9.4, 11.8, 12.2, 10.6, 9.1, 10.3, 11.0, 11.3, 10.8, 9.6, 10.1, 11.4, 12.0, 10.9, 9.8, 10.5, 11.2, 10.7, 11.0, 11.3],
    },
    {
      id: "VX-2860-D12",
      color: "var(--chart-4)",
      values: [2.8, 3.1, 3.5, 3.2, 2.9, 3.4, 3.6, 3.3, 3.0, 3.5, 3.2, 3.4, 3.1, 3.5, 3.3, 3.0, 3.4, 3.6, 3.2, 3.5, 3.3, 3.1, 3.4, 3.4],
    },
  ],
}
