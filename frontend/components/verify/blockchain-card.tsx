"use client"

import { useState } from "react"
import { Boxes, Copy, Check, ExternalLink } from "lucide-react"
import type { Batch } from "@/lib/mock-data"

export function BlockchainCard({ batch }: { batch: Batch }) {
  const [copied, setCopied] = useState(false)
  const short = `${batch.txHash.slice(0, 10)}…${batch.txHash.slice(-8)}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(batch.txHash)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <Boxes className="size-4" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Blockchain Verification</p>
          <p className="text-xs text-muted-foreground">Immutable ledger confirmation</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-safe/12 px-2.5 py-1 text-xs font-medium text-safe">
          <span className="size-1.5 rounded-full bg-safe animate-live-dot" />
          Confirmed
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Transaction Hash</span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md bg-card px-2 py-1 font-mono text-xs font-medium text-foreground ring-1 ring-border transition-colors hover:bg-secondary"
          >
            {short}
            {copied ? <Check className="size-3.5 text-safe" aria-hidden /> : <Copy className="size-3.5 text-muted-foreground" aria-hidden />}
            <span className="sr-only">Copy full transaction hash</span>
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Block Height</span>
          <span className="font-mono text-xs font-medium text-foreground">#{batch.blockHeight.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Timestamp</span>
          <span className="font-mono text-xs font-medium text-foreground">
            {new Date(batch.verifiedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-medium text-primary transition-colors hover:bg-secondary"
      >
        View on ledger explorer
        <ExternalLink className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}
