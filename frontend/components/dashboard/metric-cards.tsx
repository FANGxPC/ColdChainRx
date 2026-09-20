import { Boxes, TriangleAlert, Wifi, Network, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { metrics, type MetricCard } from "@/lib/mock-data"

const icons = [Boxes, TriangleAlert, Wifi, Network]

const toneMap: Record<MetricCard["tone"], { text: string; bg: string; ring: string }> = {
  brand: { text: "text-primary", bg: "bg-primary/10", ring: "ring-primary/15" },
  safe: { text: "text-safe", bg: "bg-safe/10", ring: "ring-safe/15" },
  alert: { text: "text-alert", bg: "bg-alert/10", ring: "ring-alert/15" },
  warn: { text: "text-warn", bg: "bg-warn/15", ring: "ring-warn/20" },
}

export function MetricCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((m, i) => {
        const Icon = icons[i]
        const tone = toneMap[m.tone]
        const TrendIcon = m.trend === "up" ? TrendingUp : m.trend === "down" ? TrendingDown : Minus
        return (
          <div
            key={m.label}
            className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-transparent transition-shadow hover:shadow-md", tone.ring)}
          >
            <div className="flex items-center justify-between">
              <div className={cn("flex size-10 items-center justify-center rounded-xl", tone.bg, tone.text)}>
                <Icon className="size-5" aria-hidden />
              </div>
              <span className={cn("inline-flex items-center gap-1 text-xs font-medium", m.tone === "alert" ? "text-alert" : "text-muted-foreground")}>
                <TrendIcon className="size-3.5" aria-hidden />
                {m.delta}
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{m.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{m.label}</p>
          </div>
        )
      })}
    </div>
  )
}
