import { Pill, Hash, CalendarClock, Factory } from "lucide-react"
import type { Batch } from "@/lib/mock-data"

export function DrugDetails({ batch }: { batch: Batch }) {
  const rows = [
    { icon: Pill, label: "Drug / Vaccine", value: batch.drug },
    { icon: Hash, label: "Batch ID", value: batch.id, mono: true },
    { icon: CalendarClock, label: "Expiry Date", value: formatDate(batch.expiry) },
    { icon: Factory, label: "Manufacturer", value: batch.manufacturer },
  ]

  return (
    <dl className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <row.icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className={`truncate text-sm font-medium text-foreground ${row.mono ? "font-mono" : ""}`}>
              {row.value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
}
