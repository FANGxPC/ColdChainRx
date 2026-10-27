import { TriangleAlert, Info, AlertCircle, Cpu } from "lucide-react"
import { cn } from "@/lib/utils"
import { alerts, type Alert } from "@/lib/mock-data"

const config: Record<Alert["severity"], { icon: typeof Info; dot: string; bar: string; label: string; labelCls: string }> = {
  critical: { icon: TriangleAlert, dot: "text-alert", bar: "bg-alert", label: "Critical", labelCls: "bg-alert/12 text-alert" },
  warning: { icon: AlertCircle, dot: "text-warn", bar: "bg-warn", label: "Warning", labelCls: "bg-warn/15 text-warn" },
  info: { icon: Info, dot: "text-primary", bar: "bg-primary", label: "Info", labelCls: "bg-primary/10 text-primary" },
}

export function AlertsFeed() {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Recent Alerts</h2>
          <p className="text-xs text-muted-foreground">Smart-contract events</p>
        </div>
        <span className="rounded-full bg-alert/12 px-2 py-0.5 text-xs font-semibold text-alert">
          {alerts.filter((a) => a.severity === "critical").length} critical
        </span>
      </div>

      <ol className="flex-1 divide-y divide-border/60 overflow-y-auto">
        {alerts.map((a) => {
          const c = config[a.severity]
          return (
            <li key={a.id} className="relative px-5 py-3.5">
              <span className={cn("absolute left-0 top-0 h-full w-0.5", c.bar)} aria-hidden />
              <div className="flex items-start gap-3">
                <div className={cn("mt-0.5 shrink-0", c.dot)}>
                  <c.icon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-foreground">{a.batch}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", c.labelCls)}>{c.label}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{a.time}</span>
                  </div>
                  <p className="mt-1 text-xs text-foreground/80">{a.message}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Cpu className="size-3" aria-hidden />
                      {a.sensor}
                    </span>
                    <span className="font-mono text-primary">{a.event}</span>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
