"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, Tags, Gauge, Flame, Repeat, TrendingUp, CreditCard as CreditCardIcon, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  NetWorthDemo,
  CategorizeDemo,
  BudgetDemo,
  FireDemo,
  SubscriptionsDemo,
  InvestmentDemo,
  CreditCardDemo,
  SecurityDemo,
} from "@/components/marketing/FeatureDemos";

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
  { icon: Flame, slot: 4, title: "FIRE, tracked for real", body: "Your FIRE number against what's actually invested, with years-to-go at your real savings pace.", Demo: FireDemo },
  { icon: Repeat, slot: 5, title: "Every subscription, caught", body: "Recurring charges detected automatically from your transaction history — nothing sneaks past a free trial.", Demo: SubscriptionsDemo },
  { icon: TrendingUp, slot: 7, title: "Investments & allocation", body: "Holdings, performance, and asset allocation across every brokerage account you connect.", Demo: InvestmentDemo },
  { icon: CreditCardIcon, slot: 8, title: "Credit card intelligence", body: "See APR, statement balance, due dates, and utilization before anything becomes a late fee.", Demo: CreditCardDemo },
  { icon: ShieldCheck, slot: 6, title: "Bank-level security", body: "Access tokens are envelope-encrypted at rest and never reach your browser.", Demo: SecurityDemo },
];

const AUTO_ADVANCE_MS = 5000;
const SWAP_OUT_MS = 200;

/**
 * Click a feature (or let it auto-advance) to see a small live demo of it —
 * replaces a flat "here's a list of things we do" grid. Desktop only: the
 * hover-to-pause interaction and the shared demo panel far from the list
 * don't translate to touch, so mobile gets MobileFeatureList instead.
 */
function DesktopShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // `active` is the target selection (drives the list highlight + glow color
  // immediately, so clicking feels responsive); `displayed` is what the
  // panel actually renders, one beat behind — it only catches up to `active`
  // after the outgoing demo has faded out, so the swap reads as a crossfade
  // instead of an instant cut.
  const [displayed, setDisplayed] = useState(0);
  const [swapping, setSwapping] = useState(false);

  // Gate auto-advance on actual visibility, not just mount: every section
  // mounts immediately on page load, so an ungated timer could be several
  // steps in by the time someone scrolls down to it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), { threshold: 0.5 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (paused || !inView) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % FEATURES.length), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [active, paused, inView]);

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
  const running = !paused && inView;

  return (
    <div
      ref={containerRef}
      className="hidden lg:grid lg:grid-cols-[minmax(0,360px)_1fr] gap-6 items-stretch"
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
                    key={`${active}-${running}`}
                    className="block h-full"
                    style={{ background: color, animation: running ? `progress-fill ${AUTO_ADVANCE_MS}ms linear forwards` : "none" }}
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

/** One self-contained card: icon, title, body, and its own demo, which mounts (and so animates) only once the card itself scrolls into view. */
function MobileFeatureCard({ feature }: { feature: Feature }) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const color = `var(--series-${feature.slot})`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex flex-col gap-4 p-5 rounded-panel border border-border bg-surface">
      <div className="flex items-center gap-3">
        <span
          className="w-9 h-9 flex-none rounded-[9px] flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
        >
          <feature.icon size={18} strokeWidth={1.75} style={{ color }} />
        </span>
        <span className="text-[15px] font-medium text-text">{feature.title}</span>
      </div>
      <p className="text-[13px] text-text-3 leading-snug">{feature.body}</p>
      <div className="rounded-card border border-border bg-canvas p-5 flex items-center justify-center min-h-[180px]">
        {revealed && <feature.Demo />}
      </div>
    </div>
  );
}

/** Mobile: a plain scrollable stack instead of the interactive panel — no hover-to-pause on touch, and no shared demo panel scrolled far from the list it corresponds to. */
function MobileFeatureList() {
  return (
    <div className="flex flex-col gap-4 lg:hidden">
      {FEATURES.map((f) => (
        <MobileFeatureCard key={f.title} feature={f} />
      ))}
    </div>
  );
}

export function FeatureShowcase() {
  return (
    <>
      <MobileFeatureList />
      <DesktopShowcase />
    </>
  );
}
