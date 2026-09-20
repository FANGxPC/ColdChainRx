import Link from "next/link"
import { Snowflake, QrCode, LayoutDashboard, ArrowRight, ShieldCheck, Cpu, Boxes } from "lucide-react"

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 clinical-grid opacity-50" aria-hidden />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" aria-hidden />

      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-10">
        <header className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Snowflake className="size-5" aria-hidden />
          </div>
          <span className="text-base font-semibold tracking-tight">
            ColdChain<span className="text-primary">Rx</span>
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-safe animate-live-dot" />
            Permissioned blockchain · IoT · ML anomaly detection
          </span>
          <h1 className="mt-5 max-w-2xl text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Trust every dose, from cold room to <span className="text-primary">patient hand.</span>
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-muted-foreground">
            ColdChainRx fuses temperature telemetry, machine-learning anomaly detection, and an immutable ledger to
            guarantee pharmaceutical cold-chain integrity.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/verify"
              className="group glass rounded-2xl border border-white/60 p-6 shadow-lg shadow-primary/5 ring-1 ring-black/[0.03] transition-transform hover:-translate-y-0.5"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-safe/12 text-safe">
                <QrCode className="size-5" aria-hidden />
              </div>
              <h2 className="mt-4 flex items-center gap-1.5 text-lg font-semibold text-foreground">
                Consumer QR Verification
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The mobile-first authenticity screen a patient or doctor sees after scanning a drug.
              </p>
            </Link>

            <Link
              href="/dashboard"
              className="group glass rounded-2xl border border-white/60 p-6 shadow-lg shadow-primary/5 ring-1 ring-black/[0.03] transition-transform hover:-translate-y-0.5"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LayoutDashboard className="size-5" aria-hidden />
              </div>
              <h2 className="mt-4 flex items-center gap-1.5 text-lg font-semibold text-foreground">
                Stakeholder Dashboard
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The desktop command center for logistics managers monitoring batches in transit.
              </p>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="size-4 text-safe" aria-hidden />Immutable ledger proof</span>
            <span className="inline-flex items-center gap-2"><Cpu className="size-4 text-primary" aria-hidden />ESP32 IoT telemetry</span>
            <span className="inline-flex items-center gap-2"><Boxes className="size-4 text-primary" aria-hidden />Isolation Forest ML</span>
          </div>
        </div>
      </div>
    </main>
  )
}
