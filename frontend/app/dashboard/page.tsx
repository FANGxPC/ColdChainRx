import { Search, Bell, Snowflake } from "lucide-react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { MetricCards } from "@/components/dashboard/metric-cards"
import { BatchTable } from "@/components/dashboard/batch-table"
import { TelemetryGraph } from "@/components/dashboard/telemetry-graph"
import { AlertsFeed } from "@/components/dashboard/alerts-feed"

export default function DashboardPage() {
  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="glass sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border px-4 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Snowflake className="size-4" aria-hidden />
            </div>
            <span className="text-sm font-semibold">
              ColdChain<span className="text-primary">Rx</span>
            </span>
          </div>

          <div className="relative hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              placeholder="Search batch ID, sensor, or location…"
              className="h-9 w-full rounded-xl border border-border bg-secondary/50 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-card"
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-safe/12 px-2.5 py-1 text-xs font-medium text-safe sm:inline-flex">
              <span className="size-1.5 rounded-full bg-safe animate-live-dot" />
              Network healthy
            </span>
            <button
              type="button"
              className="relative flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="size-4.5" aria-hidden />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-alert ring-2 ring-card" />
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-5 p-4 sm:p-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Supply Chain Overview</h1>
            <p className="text-sm text-muted-foreground">Monitoring pharmaceutical cold chains in real time.</p>
          </div>

          <MetricCards />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <TelemetryGraph />
            </div>
            <div className="min-w-0">
              <AlertsFeed />
            </div>
          </div>

          <BatchTable />
        </main>
      </div>
    </div>
  )
}
