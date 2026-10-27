import { Pill, Hash, CalendarClock, Factory, Truck, Cpu, Thermometer } from "lucide-react"
import type { Batch } from "@/lib/mock-data"

export function DrugDetails({ batch }: { batch: Batch }) {
  const drugName = batch.drugName || batch.drug || "Unknown Pharmaceutical";
  const batchId = batch.batchId || batch.id || "Unknown ID";
  const manufacturer = batch.manufacturer || "Unknown Manufacturer";
  const currentOwner = batch.currentOwner || batch.location || "Manufacturer Warehouse";
  const assignedDevice = batch.assignedDevice || "Unassigned";
  const minTemp = batch.minTemp ?? batch.minSafe ?? 2.0;
  const maxTemp = batch.maxTemp ?? batch.maxSafe ?? 8.0;

  const rows = [
    { icon: Pill, label: "Drug / Vaccine Name", value: drugName },
    { icon: Hash, label: "Batch ID", value: batchId, mono: true },
    { icon: Factory, label: "Manufacturer", value: manufacturer },
    { icon: Truck, label: "Current Custodian / Owner", value: currentOwner },
    { icon: Cpu, label: "Assigned IoT Sensor Box", value: assignedDevice, mono: true },
    { icon: Thermometer, label: "Safe Temperature Thresholds", value: `${minTemp}°C to ${maxTemp}°C` },
    { icon: CalendarClock, label: "Expiry Date", value: formatDate(batch.expiryDate || batch.expiry) },
  ]

  return (
    <dl className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
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

function formatDate(val?: string | null) {
  if (!val || val === "—") return "—"
  try {
    const d = new Date(val)
    if (isNaN(d.getTime())) return val
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  } catch {
    return val
  }
}
