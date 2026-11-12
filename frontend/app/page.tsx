import Link from "next/link";
import {
  Snowflake,
  QrCode,
  LayoutDashboard,
  Factory,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Boxes
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 clinical-grid opacity-50" aria-hidden />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" aria-hidden />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-6 py-10">
        <header className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Snowflake className="size-5" aria-hidden />
          </div>
          <span className="text-base font-semibold tracking-tight">
            ColdChain<span className="text-primary">Rx</span>
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center py-12">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="size-1.5 rounded-full bg-safe animate-live-dot" />
            Hyperledger Fabric · ESP32 IoT · Isolation Forest ML
          </span>

          <h1 className="mt-5 max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Pharmaceutical traceability & <span className="text-primary">cold-chain monitoring.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
            Authoritative batch-to-device association, real-time IoT temperature telemetry, machine-learning excursion detection, and immutable blockchain ledger verification.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* Card 1: Manufacturer Portal */}
            <Link
              href="/manufacturer"
              className="group glass rounded-2xl border border-border/80 bg-card/60 p-6 shadow-md transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Factory className="size-5" aria-hidden />
              </div>
              <h2 className="mt-4 flex items-center gap-1.5 text-base font-semibold text-foreground">
                Manufacturer Hub
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Register medicine batches on blockchain and authoritatively assign ESP32 sensor boxes.
              </p>
            </Link>

            {/* Card 2: IoT Telemetry Dashboard */}
            <Link
              href="/dashboard"
              className="group glass rounded-2xl border border-border/80 bg-card/60 p-6 shadow-md transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-safe/12 text-safe">
                <LayoutDashboard className="size-5" aria-hidden />
              </div>
              <h2 className="mt-4 flex items-center gap-1.5 text-base font-semibold text-foreground">
                Operations Command
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Live temperature & humidity curves, excursion alerts, and sensor connectivity status.
              </p>
            </Link>

            {/* Card 3: Consumer QR Verification */}
            <Link
              href="/verify"
              className="group glass rounded-2xl border border-border/80 bg-card/60 p-6 shadow-md transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <QrCode className="size-5" aria-hidden />
              </div>
              <h2 className="mt-4 flex items-center gap-1.5 text-base font-semibold text-foreground">
                Consumer QR Verify
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Patient & pharmacy portal for scanning physical medicine QR codes and auditing ledger proof.
              </p>
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-safe" aria-hidden />
              Cryptographic Fabric Endorsements
            </span>
            <span className="inline-flex items-center gap-2">
              <Cpu className="size-4 text-primary" aria-hidden />
              Authoritative ESP32 Sensor Binding
            </span>
            <span className="inline-flex items-center gap-2">
              <Boxes className="size-4 text-purple-500" aria-hidden />
              Isolation Forest Drift Analysis
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
