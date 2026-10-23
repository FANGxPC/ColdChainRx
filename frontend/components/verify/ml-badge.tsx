import { BrainCircuit, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Batch } from "@/lib/mock-data"

type MlResult = {
  is_anomaly: boolean
  anomaly_score: number
  prediction: number
  fallback_used?: boolean
}

type MlBadgeProps = {
  batch: Batch
  /** Live ML result from the Flask Isolation Forest service, if available */
  mlResult?: MlResult | null
  /** True while the ML request is in-flight */
  mlLoading?: boolean
}

export function MlBadge({ batch, mlResult, mlLoading = false }: MlBadgeProps) {
  // Use the live ML result when available; otherwise fall back to the
  // heuristic derived from batch.anomalies (count > 0 → anomaly)
  const isAnomaly = mlResult ? mlResult.is_anomaly : batch.anomalies > 0
  const clean = !isAnomaly

  // Build a human-readable score label when we have a real ML score
  const scoreLabel = mlResult
    ? `Score: ${mlResult.anomaly_score.toFixed(3)}${mlResult.fallback_used ? " (rule-based)" : ""}`
    : `${batch.anomalies} anomalies detected`

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
          mlLoading ? "bg-muted" : clean ? "bg-safe" : "bg-alert",
        )}
      >
        {mlLoading ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <BrainCircuit className="size-5" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {mlLoading
            ? "Running Isolation Forest…"
            : clean
            ? "No Anomalies Detected"
            : "Anomaly Detected"}
        </p>
        <p className="text-xs text-muted-foreground">
          {mlLoading
            ? "Querying ML service"
            : `Isolation Forest model · ${
                clean
                  ? "all telemetry within learned normal bounds"
                  : "thermal outlier flagged"
              }`}
        </p>
        {!mlLoading && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/70 font-mono">{scoreLabel}</p>
        )}
      </div>

      <span
        className={cn(
          "ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
          mlLoading
            ? "bg-muted text-muted-foreground"
            : clean
            ? "bg-safe/12 text-safe"
            : "bg-alert/12 text-alert",
        )}
      >
        {mlLoading ? "…" : clean ? "Pass" : "Review"}
      </span>
    </div>
  )
}
