import Link from "next/link"
import { Snowflake, LayoutDashboard, Boxes, Thermometer, Bell, ShieldCheck, Settings, QrCode } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: Boxes, label: "Batches" },
  { icon: Thermometer, label: "Telemetry" },
  { icon: Bell, label: "Alerts", badge: "3" },
  { icon: ShieldCheck, label: "Ledger" },
]

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
          <Snowflake className="size-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">
            ColdChain<span className="text-sidebar-primary">Rx</span>
          </p>
          <p className="text-[11px] text-sidebar-foreground/60">Cold Chain Command</p>
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {nav.map((item) => (
          <a
            key={item.label}
            href="#"
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              item.active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-4.5" aria-hidden />
            {item.label}
            {item.badge && (
              <span className="ml-auto rounded-full bg-alert px-1.5 py-0.5 text-[10px] font-semibold text-alert-foreground">
                {item.badge}
              </span>
            )}
          </a>
        ))}
      </nav>

      <div className="space-y-1 px-3 pb-3">
        <Link
          href="/verify"
          className="flex items-center gap-3 rounded-xl bg-sidebar-primary/15 px-3 py-2.5 text-sm font-medium text-sidebar-primary-foreground ring-1 ring-sidebar-primary/30 transition-colors hover:bg-sidebar-primary/25"
        >
          <QrCode className="size-4.5" aria-hidden />
          Consumer QR view
        </Link>
        <a
          href="#"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        >
          <Settings className="size-4.5" aria-hidden />
          Settings
        </a>
      </div>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">
            LM
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Logistics Ops</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">Helix Biologics</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
