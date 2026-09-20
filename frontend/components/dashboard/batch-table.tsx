import { MapPin, Check, RefreshCw, Clock, CircleCheck, CircleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { batches, SAFE_MAX, SAFE_MIN, type Batch } from "@/lib/mock-data"

export function BatchTable() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Active Batches</h2>
          <p className="text-xs text-muted-foreground">Live status across the permissioned network</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-safe/12 px-2.5 py-1 text-xs font-medium text-safe">
          <span className="size-1.5 rounded-full bg-safe animate-live-dot" />
          Streaming
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Batch ID</th>
              <th className="px-5 py-3 font-medium">Current Location</th>
              <th className="px-5 py-3 font-medium">Live Temp</th>
              <th className="px-5 py-3 font-medium">ML Status</th>
              <th className="px-5 py-3 font-medium">Ledger Sync</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-b border-border/60 last:border-0 transition-colors hover:bg-secondary/40">
                <td className="px-5 py-3.5">
                  <span className="font-mono text-xs font-medium text-foreground">{b.id}</span>
                  <p className="mt-0.5 max-w-[11rem] truncate text-[11px] text-muted-foreground">{b.drug}</p>
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="max-w-[14rem] truncate">{b.location}</span>
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <TempPill batch={b} />
                </td>
                <td className="px-5 py-3.5">
                  <MlPill batch={b} />
                </td>
                <td className="px-5 py-3.5">
                  <SyncPill batch={b} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TempPill({ batch }: { batch: Batch }) {
  const breached = batch.liveTemp > SAFE_MAX || batch.liveTemp < SAFE_MIN
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs font-semibold",
        breached ? "bg-alert/12 text-alert" : "bg-safe/12 text-safe",
      )}
    >
      {batch.liveTemp.toFixed(1)}°C
    </span>
  )
}

function MlPill({ batch }: { batch: Batch }) {
  const anomaly = batch.ml === "anomaly"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        anomaly ? "bg-alert/12 text-alert" : "bg-safe/12 text-safe",
      )}
    >
      {anomaly ? <CircleAlert className="size-3.5" aria-hidden /> : <CircleCheck className="size-3.5" aria-hidden />}
      {anomaly ? "Anomaly" : "Normal"}
    </span>
  )
}

function SyncPill({ batch }: { batch: Batch }) {
  const map = {
    synced: { icon: Check, label: "Synced", cls: "bg-safe/12 text-safe", spin: false },
    syncing: { icon: RefreshCw, label: "Syncing", cls: "bg-primary/10 text-primary", spin: true },
    pending: { icon: Clock, label: "Pending", cls: "bg-warn/15 text-warn", spin: false },
  } as const
  const s = map[batch.sync]
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", s.cls)}>
      <s.icon className={cn("size-3.5", s.spin && "animate-spin")} aria-hidden />
      {s.label}
    </span>
  )
}
