import { ShieldCheck, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BatchStatus } from "@/lib/mock-data"

export function StatusBadge({ status }: { status: BatchStatus }) {
  const authentic = status === "authentic"

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          "flex size-28 items-center justify-center rounded-full",
          authentic ? "bg-safe/12 animate-pulse-ring" : "bg-alert/12 animate-pulse-ring-alert",
        )}
      >
        <div
          className={cn(
            "flex size-20 items-center justify-center rounded-full text-white shadow-lg",
            authentic ? "bg-safe shadow-safe/30" : "bg-alert shadow-alert/30",
          )}
        >
          {authentic ? (
            <ShieldCheck className="size-10" strokeWidth={2.2} aria-hidden />
          ) : (
            <ShieldAlert className="size-10" strokeWidth={2.2} aria-hidden />
          )}
        </div>
      </div>

      <h1 className={cn("mt-5 text-2xl font-semibold tracking-tight", authentic ? "text-safe" : "text-alert")}>
        {authentic ? "Verified Authentic" : "Compromised"}
      </h1>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {authentic
          ? "This product's integrity is confirmed end-to-end on the permissioned ledger."
          : "A thermal breach was recorded in transit. Do not administer — contact your supplier."}
      </p>
    </div>
  )
}
