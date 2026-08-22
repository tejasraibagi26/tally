"use client";

import { useEffect, useState } from "react";
import { Layers, Tags, Gauge, TrendingUp, CreditCard as CreditCardIcon, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { NetWorthDemo, CategorizeDemo, BudgetDemo, InvestmentDemo, CreditCardDemo, SecurityDemo } from "@/components/marketing/FeatureDemos";

interface Feature {
  icon: LucideIcon;
  slot: number;
  title: string;
  body: string;
  Demo: React.ComponentType;
}

const FEATURES: Feature[] = [
  { icon: Layers, slot: 1, title: "Net worth, always current", body: "Every checking, savings, credit card, and brokerage account in one ledger, synced automatically.", Demo: NetWorthDemo },
  { icon: Tags, slot: 2, title: "Categorization that sticks", body: "Rules you set once apply forever, so a card payment is never double-counted as spend.", Demo: CategorizeDemo },
  { icon: Gauge, slot: 3, title: "Budgets with a pulse", body: "Real burn-down per category, projected to the end of the month, not just a static number.", Demo: BudgetDemo },
  { icon: TrendingUp, slot: 7, title: "Investments & allocation", body: "Holdings, performance, and asset allocation across every brokerage account you connect.", Demo: InvestmentDemo },
  { icon: CreditCardIcon, slot: 8, title: "Credit card intelligence", body: "See APR, statement balance, due dates, and utilization before anything becomes a late fee.", Demo: CreditCardDemo },
  { icon: ShieldCheck, slot: 6, title: "Bank-level security", body: "Access tokens are envelope-encrypted at rest and never reach your browser.", Demo: SecurityDemo },
];

const AUTO_ADVANCE_MS = 5000;
const SWAP_OUT_MS = 200;

/** Click a feature (or let it auto-advance) to see a small live demo of it — replaces a flat "here's a list of things we do" grid. */
export function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // `active` is the target selection (drives the list highlight + glow color
  // immediately, so clicking feels responsive); `displayed` is what the
  // panel actually renders, one beat behind — it only catches up to `active`
  // after the outgoing demo has faded out, so the swap reads as a crossfade
  // instead of an instant cut.
  const [displayed, setDisplayed] = useState(0);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % FEATURES.length), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [active, paused]);

  useEffect(() => {
    if (active === displayed) return;
    setSwapping(true);
    const id = setTimeout(() => {
      setDisplayed(active);
      setSwapping(false);
    }, SWAP_OUT_MS);
    return () => clearTimeout(id);
  }, [active, displayed]);

  const current = FEATURES[active]!;
  const shown = FEATURES[displayed]!;

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-6 items-stretch"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex flex-col gap-1">
        {FEATURES.map((f, i) => {
          const isActive = i === active;
          const color = `var(--series-${f.slot})`;
          return (
            <button
              key={f.title}
              onClick={() => setActive(i)}
              className={cn(
                "relative text-left flex items-start gap-3 p-3.5 rounded-card border transition-colors duration-300 overflow-hidden",
                isActive ? "border-border bg-surface" : "border-transparent hover:bg-surface-2",
              )}
            >
              <span
                className="w-9 h-9 flex-none rounded-[9px] flex items-center justify-center transition-colors duration-300"
                style={{ background: isActive ? `color-mix(in srgb, ${color} 18%, transparent)` : "var(--sunken)" }}
              >
                <f.icon size={18} strokeWidth={1.75} style={{ color: isActive ? color : "var(--text-3)" }} />
              </span>
              <span className="flex flex-col gap-0.5 min-w-0 pb-1">
                <span className={cn("text-[15px] font-medium", isActive ? "text-text" : "text-text-2")}>{f.title}</span>
                {isActive && <span className="text-[13px] text-text-3 leading-snug">{f.body}</span>}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-3.5 right-3.5 h-[2px] bg-border overflow-hidden rounded-full">
                  <span
                    key={`${active}-${paused}`}
                    className="block h-full"
                    style={{ background: color, animation: paused ? "none" : `progress-fill ${AUTO_ADVANCE_MS}ms linear forwards` }}
                  />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="relative bg-surface border border-border rounded-panel p-8 flex items-center justify-center h-full min-h-[320px] overflow-hidden">
        <div
          className="pointer-events-none absolute -bottom-16 -right-16 w-56 h-56 rounded-full opacity-[0.10] blur-3xl transition-colors duration-500"
          style={{ background: `var(--series-${current.slot})` }}
          aria-hidden
        />
        <div
          key={displayed}
          className={cn(
            "relative w-full transition-[opacity,transform] duration-200 ease-in-out",
            swapping ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0",
          )}
        >
          <shown.Demo />
        </div>
      </div>
    </div>
  );
}
