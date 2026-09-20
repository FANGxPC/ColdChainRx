import { BrainCircuit } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Batch } from "@/lib/mock-data"

export function MlBadge({ batch }: { batch: Batch }) {
  const clean = batch.anomalies === 0

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-4",
        clean ? "border-safe/25 bg-safe/[0.06]" : "border-alert/25 bg-alert/[0.06]",
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl text-white",
          clean ? "bg-safe" : "bg-alert",
        )}
      >
        <BrainCircuit className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {clean ? "0 Anomalies Detected" : `${batch.anomalies} Anomalies Detected`}
        </p>
        <p className="text-xs text-muted-foreground">
          Isolation Forest model · {clean ? "all telemetry within learned normal bounds" : "thermal outliers flagged in transit"}
        </p>
      </div>
      <span
        className={cn(
          "ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
          clean ? "bg-safe/12 text-safe" : "bg-alert/12 text-alert",
        )}
      >
        {clean ? "Pass" : "Review"}
      </span>
    </div>
  )
}
