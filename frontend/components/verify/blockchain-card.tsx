"use client"

import { useState } from "react"
import { Boxes, Copy, Check, ExternalLink, ShieldCheck, Network, Layers } from "lucide-react"
import type { Batch } from "@/lib/mock-data"

function parseFabricTimestamp(ts?: string | null): string {
  if (!ts) return new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  
  // Handle Fabric protobuf format "seconds:1792954591 nanos:810000000"
  const secMatch = String(ts).match(/seconds:\s*(\d+)/);
  if (secMatch) {
    const secs = parseInt(secMatch[1], 10);
    return new Date(secs * 1000).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }

  // Handle standard ISO or string
  const d = new Date(ts);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  }

  return String(ts);
}

export function BlockchainCard({ batch }: { batch: Batch }) {
  const [copied, setCopied] = useState(false)

  // Support both 64-char Fabric TxID and legacy hash
  const rawTx =
    batch?.txId ||
    batch?.txHash ||
    "b6a82a7f51953ce02672fa69c5305ce7b5454d6a13f6797a7e8b67eb637a77b8"

  const short = rawTx.length > 20 ? `${rawTx.slice(0, 10)}…${rawTx.slice(-8)}` : rawTx

  async function copy() {
    try {
      await navigator.clipboard.writeText(rawTx)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  const verifiedDate = parseFabricTimestamp(batch?.verifiedAt);

  return (
    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Boxes className="size-4" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Hyperledger Fabric Verification</p>
          <p className="text-xs text-muted-foreground">Channel: coldchainchannel · Chaincode: coldchainrx v1.1</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-safe/12 px-2.5 py-1 text-xs font-medium text-safe">
          <span className="size-1.5 rounded-full bg-safe animate-live-dot" />
          Committed
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Fabric Transaction ID</span>
          <button
            type="button"
            onClick={copy}
            title={rawTx}
            className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 font-mono text-xs font-medium text-foreground ring-1 ring-border transition-colors hover:bg-secondary"
          >
            {short}
            {copied ? (
              <Check className="size-3.5 text-safe" aria-hidden />
            ) : (
              <Copy className="size-3.5 text-muted-foreground" aria-hidden />
            )}
            <span className="sr-only">Copy full transaction hash</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Consensus Endorsement</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
            <ShieldCheck className="size-3.5 text-safe" />
            2/3 Majority (MSP Verified)
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Network Nodes</span>
          <span className="text-xs font-medium text-foreground">
            Manufacturer · Distributor · Pharmacy
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Ledger Commit Time</span>
          <span className="font-mono text-xs font-medium text-foreground">
            {verifiedDate}
          </span>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card/60 py-2 text-xs font-medium text-muted-foreground">
          <Layers className="size-3.5 text-primary" aria-hidden />
          <span>Raft CFT Consensus</span>
        </div>
        <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-card/60 py-2 text-xs font-medium text-muted-foreground">
          <Network className="size-3.5 text-primary" aria-hidden />
          <span>gRPC TLS 7051</span>
        </div>
      </div>
    </div>
  )
}
