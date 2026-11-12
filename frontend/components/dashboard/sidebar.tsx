"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Snowflake,
  LayoutDashboard,
  Factory,
  QrCode,
  ShieldCheck,
  Boxes,
  Thermometer,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  const links = [
    {
      href: "/dashboard",
      icon: LayoutDashboard,
      label: "Live Telemetry",
      active: pathname === "/dashboard",
    },
    {
      href: "/manufacturer",
      icon: Factory,
      label: "Manufacturer Hub",
      active: pathname === "/manufacturer",
      badge: "Create & Assign",
    },
    {
      href: "/verify",
      icon: QrCode,
      label: "Consumer QR Portal",
      active: pathname?.startsWith("/verify"),
    },
  ];

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

      <nav className="mt-4 flex-1 space-y-1.5 px-3">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 mb-2">
          Operations
        </p>
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors",
              item.active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                {item.badge}
              </span>
            )}
          </Link>
        ))}

        <div className="pt-4 mt-4 border-t border-sidebar-border">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 mb-2">
            Verification Protocol
          </p>
          <div className="space-y-1 px-3 text-xs text-sidebar-foreground/70">
            <div className="flex items-center gap-2 py-1">
              <ShieldCheck className="size-3.5 text-safe" />
              <span>Hyperledger Fabric</span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <Thermometer className="size-3.5 text-primary" />
              <span>IoT MQTT Stream</span>
            </div>
            <div className="flex items-center gap-2 py-1">
              <Boxes className="size-3.5 text-purple-400" />
              <span>Isolation Forest ML</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold">
            LM
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">Logistics Ops</p>
            <p className="truncate text-[10px] text-sidebar-foreground/60">Helix Biologics Node</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
