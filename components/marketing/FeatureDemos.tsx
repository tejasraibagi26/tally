import { Lock } from "lucide-react";
import { formatCents } from "@/lib/money";

/**
 * Small, self-contained "watch it happen" visuals for FeatureShowcase — each
 * one is remounted (via a `key` change on its parent) every time it becomes
 * the active feature, which restarts its CSS animations from scratch. Plain
 * keyframes, no JS timers, so replay is just "mount the component again."
 */

export function NetWorthDemo() {
  const rows = [
    { name: "Everyday Checking", amount: 482_016, slot: 1 },
    { name: "High-Yield Savings", amount: 1_842_355, slot: 3 },
    { name: "Signature Card", amount: -134_582, slot: 8 },
    { name: "Brokerage", amount: 2_184_293, slot: 7 },
  ];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="flex flex-col gap-3 w-full max-w-[340px] mx-auto">
      {rows.map((r, i) => (
        <div
          key={r.name}
          className="flex items-center justify-between opacity-0"
          style={{ animation: `fade-in-up 500ms ease-out ${i * 130}ms forwards` }}
        >
          <span className="flex items-center gap-2 text-[14px] text-text-2">
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: `var(--series-${r.slot})` }} />
            {r.name}
          </span>
          <span className="text-[14px] tabular text-text">{formatCents(r.amount, { signed: true })}</span>
        </div>
      ))}
      <div className="h-px bg-border opacity-0" style={{ animation: "fade-in-up 400ms ease-out 560ms forwards" }} />
      <div className="flex items-center justify-between opacity-0" style={{ animation: "fade-in-up 500ms ease-out 650ms forwards" }}>
        <span className="text-xs font-medium uppercase tracking-wide text-text-3">Net worth</span>
        <span className="font-display text-[28px] leading-none text-text tabular">{formatCents(total)}</span>
      </div>
    </div>
  );
}

export function CategorizeDemo() {
  return (
    <div className="flex flex-col gap-4 w-full max-w-[340px] mx-auto">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 flex-none rounded-[7px] bg-sunken flex items-center justify-center text-xs font-medium text-text-2">A</span>
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-[14px] text-text truncate">AMAZON.COM*A1B2C3</span>
          <span className="text-[12px] text-text-3">Today</span>
        </div>
        <span className="text-[14px] text-negative tabular flex-none">−$34.99</span>
      </div>

      <div className="flex items-center gap-2 opacity-0" style={{ animation: "fade-in-up 400ms ease-out 500ms forwards" }}>
        <span className="text-text-3 text-sm" aria-hidden>
          →
        </span>
        <span
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[13px] font-medium opacity-0"
          style={{
            background: "color-mix(in srgb, var(--series-3) 16%, transparent)",
            color: "var(--series-3)",
            animation: "tag-pop 450ms ease-out 650ms forwards",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--series-3)" }} />
          Online shopping
        </span>
      </div>

      <div className="flex items-center gap-2 text-[13px] text-text-3 opacity-0" style={{ animation: "fade-in-up 400ms ease-out 1150ms forwards" }}>
        <span className="text-positive" aria-hidden>
          ✓
        </span>
        Rule saved. Every future Amazon charge tags itself automatically.
      </div>
    </div>
  );
}

export function BudgetDemo() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[340px] mx-auto">
      <div className="flex items-center justify-between text-[14px]">
        <span className="text-text">Dining out</span>
        <span className="text-text-2 tabular">$361 of $500</span>
      </div>
      <div className="h-2.5 rounded-full bg-sunken overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ background: "var(--series-3)", width: 0, ["--target-width" as string]: "72%", animation: "grow-width 1.1s ease-out 200ms forwards" }}
        />
      </div>
      <div className="flex items-center justify-between text-[12px] text-text-3 opacity-0" style={{ animation: "fade-in-up 400ms ease-out 1300ms forwards" }}>
        <span>72% used, 18 days in</span>
        <span>Projected: $602 by month end</span>
      </div>
    </div>
  );
}

export function InvestmentDemo() {
  const segments = [
    { label: "ETF", pct: 52, slot: 1 },
    { label: "Equity", pct: 28, slot: 7 },
    { label: "Cash", pct: 20, slot: 6 },
  ] as const;

  return (
    <div className="flex flex-col gap-4 w-full max-w-[340px] mx-auto">
      <span className="text-xs font-medium uppercase tracking-wide text-text-3">Portfolio value</span>
      <span className="font-display text-[28px] leading-none text-text tabular opacity-0" style={{ animation: "fade-in-up 500ms ease-out forwards" }}>
        $218,430.11
      </span>
      <div className="h-4 rounded-full overflow-hidden flex bg-sunken">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="h-full opacity-0"
            style={{ width: `${s.pct}%`, background: `var(--series-${s.slot})`, animation: `fade-in-up 400ms ease-out ${400 + i * 250}ms forwards` }}
          />
        ))}
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        {segments.map((s, i) => (
          <span
            key={s.label}
            className="flex items-center gap-1.5 text-[13px] text-text-2 opacity-0"
            style={{ animation: `fade-in-up 400ms ease-out ${900 + i * 150}ms forwards` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: `var(--series-${s.slot})` }} />
            {s.label} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export function FireDemo() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[340px] mx-auto">
      <span className="text-xs font-medium uppercase tracking-wide text-text-3">FIRE number</span>
      <span className="font-display text-[28px] leading-none text-text tabular opacity-0" style={{ animation: "fade-in-up 500ms ease-out forwards" }}>
        $1,750,000
      </span>
      <div className="h-2.5 rounded-full bg-sunken overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ background: "var(--series-4)", width: 0, ["--target-width" as string]: "61%", animation: "grow-width 1.1s ease-out 200ms forwards" }}
        />
      </div>
      <div className="flex items-center justify-between text-[12px] text-text-3 opacity-0" style={{ animation: "fade-in-up 400ms ease-out 1300ms forwards" }}>
        <span>$1,067,500 invested · 61% there</span>
        <span>≈14.2 years at this pace</span>
      </div>
    </div>
  );
}

export function SubscriptionsDemo() {
  const rows = [
    { name: "Netflix", frequency: "Monthly", amount: -1549, slot: 5 },
    { name: "Spotify", frequency: "Monthly", amount: -1099, slot: 5 },
    { name: "Gym membership", frequency: "Monthly", amount: -4500, slot: 5 },
  ];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="flex flex-col gap-3 w-full max-w-[340px] mx-auto">
      {rows.map((r, i) => (
        <div
          key={r.name}
          className="flex items-center justify-between opacity-0"
          style={{ animation: `fade-in-up 500ms ease-out ${i * 130}ms forwards` }}
        >
          <span className="flex items-center gap-2 text-[14px] text-text-2">
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: `var(--series-${r.slot})` }} />
            {r.name}
            <span className="text-[12px] text-text-3">· {r.frequency}</span>
          </span>
          <span className="text-[14px] tabular text-text">{formatCents(r.amount, { signed: true })}</span>
        </div>
      ))}
      <div className="h-px bg-border opacity-0" style={{ animation: "fade-in-up 400ms ease-out 560ms forwards" }} />
      <div className="flex items-center justify-between opacity-0" style={{ animation: "fade-in-up 500ms ease-out 650ms forwards" }}>
        <span className="text-xs font-medium uppercase tracking-wide text-text-3">Monthly recurring</span>
        <span className="font-display text-[22px] leading-none text-text tabular">{formatCents(total, { signed: true })}</span>
      </div>
    </div>
  );
}

export function CreditCardDemo() {
  return (
    <div className="flex flex-col gap-4 w-full max-w-[340px] mx-auto">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-medium text-text">Signature Card</span>
        <span
          className="text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full opacity-0"
          style={{ background: "var(--warning-subtle)", color: "var(--warning)", animation: "tag-pop 450ms ease-out 900ms forwards" }}
        >
          Due in 6 days
        </span>
      </div>
      <div className="flex items-center justify-between text-[13px] text-text-2">
        <span>Utilization</span>
        <span className="tabular">34%</span>
      </div>
      <div className="h-2.5 rounded-full bg-sunken overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ background: "var(--series-8)", width: 0, ["--target-width" as string]: "34%", animation: "grow-width 1s ease-out 200ms forwards" }}
        />
      </div>
      <div className="flex items-center justify-between text-[13px] text-text-3 opacity-0" style={{ animation: "fade-in-up 400ms ease-out 1100ms forwards" }}>
        <span>Purchase APR</span>
        <span className="tabular">24.99%</span>
      </div>
    </div>
  );
}

export function SecurityDemo() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-[340px] mx-auto">
      <div
        className="flex items-center gap-3 bg-surface-2 border border-border rounded-control p-3 opacity-0"
        style={{ animation: "fade-in-up 400ms ease-out forwards" }}
      >
        <span className="w-8 h-8 flex-none rounded-[7px] bg-sunken flex items-center justify-center text-xs font-medium text-text-2">WE</span>
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-[14px] text-text truncate">Wealthsimple access token</span>
          <span className="font-mono text-[11px] text-text-3 truncate">access-sandbox-8f2e1c9b4a7d</span>
        </div>
      </div>

      <div className="flex items-center justify-center py-1">
        <span
          className="relative flex items-center justify-center w-14 h-14 rounded-full opacity-0"
          style={{ background: "color-mix(in srgb, var(--series-6) 16%, transparent)", animation: "tag-pop 500ms ease-out 450ms forwards" }}
        >
          <span
            className="absolute inset-0 rounded-full border"
            style={{ borderColor: "color-mix(in srgb, var(--series-6) 35%, transparent)" }}
            aria-hidden
          />
          <Lock size={22} strokeWidth={1.75} style={{ color: "var(--series-6)" }} />
        </span>
      </div>

      <div
        className="flex items-center gap-3 bg-surface-2 border border-border rounded-control p-3 opacity-0"
        style={{ animation: "fade-in-up 400ms ease-out 950ms forwards" }}
      >
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <span className="text-[14px] text-text">Stored ciphertext</span>
          <span className="font-mono text-[11px] text-text-3 truncate">7f3a9c••••••••••••••••e21b</span>
        </div>
        <span
          className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-medium flex-none opacity-0"
          style={{
            background: "color-mix(in srgb, var(--positive) 16%, transparent)",
            color: "var(--positive)",
            animation: "tag-pop 400ms ease-out 1250ms forwards",
          }}
        >
          Encrypted
        </span>
      </div>

      <span className="text-[12px] text-text-3 text-center opacity-0" style={{ animation: "fade-in-up 400ms ease-out 1550ms forwards" }}>
        AES-256-GCM · never reaches your browser
      </span>
    </div>
  );
}
