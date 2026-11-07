"use client";

import { useMemo, useState } from "react";
import { affordCheck, linePoints, yFor, type AffordStatus } from "@tally/core/nowView";
import { formatCents } from "@tally/core/money";

export interface AffordEvent {
  date: string;
  /** Signed cents: positive is money in. */
  amount: number;
  label: string;
}

export interface Headline {
  title: string;
  sub: string;
  tone: "lime" | "amber" | "coral" | "ink";
}

const TONE: Record<Headline["tone"], string> = { lime: "#c9f26b", amber: "#f2b84b", coral: "#ff7a66", ink: "#f2f1ea" };
const STATUS_TONE: Record<AffordStatus, Headline["tone"]> = { fine: "lime", tight: "amber", short: "coral" };
const PRESETS = [10_000, 50_000, 100_000, 250_000];

function dollars(cents: number): string {
  return formatCents(Math.round(cents / 100) * 100).replace(/\.00$/, "");
}
function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The answer to "can I afford X today?", in the same voice as the default headline. */
function answer(amount: number, days: { date: string; balance: number }[], cushion: number): Headline | null {
  const r = affordCheck(days, amount, cushion);
  if (!r) return null;
  const lowWhen = shortDate(r.low.date);
  const buffer = cushion > 0 ? ` your ${dollars(cushion)} buffer` : " $0";
  if (r.status === "fine") {
    return { tone: "lime", title: `Yes. ${dollars(amount)} is fine.`, sub: `Even after it, the lowest you'd get is ${dollars(r.low.amount)}, on ${lowWhen}. Nothing else has to change.` };
  }
  if (r.status === "tight") {
    return { tone: "amber", title: `Yes, but ${lowWhen} gets tight.`, sub: `You'd be down to ${dollars(r.low.amount)} then. Doable, with little room to spare.` };
  }
  const left = r.low.amount < 0 ? `leaves you ${dollars(-r.low.amount)} short on ${lowWhen}` : `leaves just ${dollars(r.low.amount)} on ${lowWhen}, under${buffer}`;
  return {
    tone: STATUS_TONE[r.status],
    title: r.waitUntil ? `Not yet. Wait until ${shortDate(r.waitUntil)}.` : "Not in the next 30 days.",
    sub: `Buying it today ${left}.${r.waitUntil ? ` From ${shortDate(r.waitUntil)} it fits.` : ""}`,
  };
}

const W = 1000;
const H = 240;
const PAD = 14;

/**
 * Today's headline, the "Can I afford it?" box and the next 30 days of cash,
 * drawn as one line. Typing an amount takes it off every day and rewrites
 * the headline and the line together. `children` sits between the headline
 * and the box (the server-rendered "where you stand" sections).
 */
export function AffordPanel({
  days,
  events,
  cushion,
  headline,
  children,
}: {
  days: { date: string; balance: number }[];
  events: AffordEvent[];
  cushion: number;
  headline: Headline;
  children?: React.ReactNode;
}) {
  const [raw, setRaw] = useState("");
  const amount = Math.round((Number(raw.replace(/[^0-9.]/g, "")) || 0) * 100);
  const shown = (amount > 0 && answer(amount, days, cushion)) || headline;

  const chart = useMemo(() => {
    if (days.length < 2) return null;
    const base = days.map((d) => d.balance);
    const after = base.map((b) => b - amount);
    const min = Math.min(0, cushion, ...after);
    const max = Math.max(...base, cushion + 1);
    const range = { min: min - (max - min) * 0.08, max };
    let lowI = 0;
    after.forEach((v, i) => {
      if (v < after[lowI]!) lowI = i;
    });
    const xFor = (date: string) => {
      const i = days.findIndex((d) => d.date >= date);
      return ((i < 0 ? days.length - 1 : i) / (days.length - 1)) * 100;
    };
    // Label the biggest moves only, so the strip stays readable.
    const labelled = [...events]
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 6)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e, i) => ({ ...e, left: xFor(e.date), row: i % 2 }));
    return {
      after: linePoints(after, W, H, PAD, range),
      base: amount > 0 ? linePoints(base, W, H, PAD, range) : "",
      zeroY: yFor(0, H, range, PAD),
      cushionY: cushion > 0 ? yFor(cushion, H, range, PAD) : null,
      low: { left: (lowI / (days.length - 1)) * 100, top: yFor(after[lowI]!, H, range, PAD), amount: after[lowI]!, date: days[lowI]!.date },
      startTop: yFor(after[0]!, H, range, PAD),
      marks: events.map((e) => ((xFor(e.date) / 100) * W).toFixed(1)),
      labelled,
    };
  }, [days, events, amount, cushion]);

  const tone = TONE[shown.tone];
  const lastDay = days.at(-1)?.date;

  return (
    <>
      <section className="tn-section" style={{ gap: 10 }} aria-live="polite">
        <h1 className="tn-disp" style={{ margin: 0, fontSize: "clamp(32px, 4vw, 44px)", lineHeight: 1.05, fontWeight: 700, color: tone }}>
          {shown.title}
        </h1>
        <p style={{ margin: 0, fontSize: 18, color: "var(--tn-ink-3)", maxWidth: "62ch" }}>{shown.sub}</p>
      </section>

      {children}

      {chart && (
        <>
          <section aria-label="Can I afford it?" className="tn-card" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "18px 20px" }}>
            <label htmlFor="tn-afford" className="tn-disp" style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em", marginRight: 4 }}>
              Can I afford
            </label>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} className="tn-input">
              <span className="tn-disp tn-muted" style={{ fontSize: 20 }}>
                $
              </span>
              <input
                id="tn-afford"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                className="tn-disp"
                style={{ width: 110, background: "none", border: 0, outline: "none", color: "inherit", fontSize: 22, fontWeight: 700 }}
              />
            </span>
            <span className="tn-muted" style={{ marginRight: 6 }}>
              today?
            </span>
            {PRESETS.map((p) => (
              <button key={p} type="button" className="tn-chip" aria-pressed={amount === p} onClick={() => setRaw(amount === p ? "" : String(p / 100))}>
                {dollars(p)}
              </button>
            ))}
          </section>

          <section className="tn-section" style={{ gap: 8 }}>
            <div className="tn-section-head">
              <h2 className="tn-h2">Your next 30 days</h2>
              <span className="tn-faint" style={{ fontSize: 13 }}>
                Cash accounts, with the bills and paydays Tally knows about and your usual day-to-day spending
              </span>
            </div>
            <div style={{ position: "relative", paddingTop: 48, paddingBottom: 52 }}>
              {chart.labelled
                .filter((e) => e.row === 0)
                .map((e) => (
                  <EventLabel key={`${e.date}-${e.label}`} e={e} at="top" />
                ))}
              <div style={{ position: "relative", height: H }}>
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: H }} role="img" aria-label={`Projected cash: lowest ${dollars(chart.low.amount)} on ${shortDate(chart.low.date)}`}>
                  <rect x="0" y={chart.zeroY} width={W} height={Math.max(0, H - chart.zeroY)} fill="#ff7a66" fillOpacity="0.07" />
                  <line x1="0" y1={chart.zeroY} x2={W} y2={chart.zeroY} stroke="#4a4a42" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                  {chart.cushionY != null && <line x1="0" y1={chart.cushionY} x2={W} y2={chart.cushionY} stroke="#f2b84b" strokeOpacity="0.5" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />}
                  {chart.marks.map((x, i) => (
                    <line key={i} x1={x} y1="0" x2={x} y2={H} stroke="#23231f" vectorEffect="non-scaling-stroke" />
                  ))}
                  {chart.base && <polyline points={chart.base} fill="none" stroke="#3a3a33" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
                  <polyline points={chart.after} fill="none" stroke={tone} strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </svg>
                <span className="tn-faint" style={{ position: "absolute", left: 0, top: chart.zeroY, transform: "translateY(-120%)", fontSize: 12 }}>
                  $0
                </span>
                <span style={{ position: "absolute", left: 0, top: chart.startTop, width: 14, height: 14, margin: "-7px 0 0 -7px", borderRadius: "50%", background: "var(--tn-ink)", boxShadow: "0 0 0 5px var(--tn-bg)" }} />
                <div style={{ position: "absolute", left: `${chart.low.left}%`, top: chart.low.top, transform: `translate(${chart.low.left > 80 ? "-90%" : chart.low.left < 15 ? "-10%" : "-50%"}, 0)`, textAlign: "center" }}>
                  <span style={{ display: "block", width: 16, height: 16, margin: "-8px auto 0", borderRadius: "50%", background: tone, boxShadow: "0 0 0 5px var(--tn-bg)" }} />
                  <span className="money" style={{ display: "inline-block", marginTop: 10, padding: "6px 10px", borderRadius: 10, background: "var(--tn-ink)", color: "var(--tn-bg)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
                    Lowest: {dollars(chart.low.amount)} · {shortDate(chart.low.date)}
                  </span>
                </div>
              </div>
              {chart.labelled
                .filter((e) => e.row === 1)
                .map((e) => (
                  <EventLabel key={`${e.date}-${e.label}`} e={e} at="bottom" />
                ))}
            </div>
            <div className="tn-faint" style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>Today</span>
              {lastDay && <span>{shortDate(lastDay)}</span>}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function EventLabel({ e, at }: { e: AffordEvent & { left: number }; at: "top" | "bottom" }) {
  const edge = e.left > 85 ? "right" : e.left < 8 ? "left" : "center";
  return (
    <div
      style={{
        position: "absolute",
        left: `${e.left}%`,
        [at]: 0,
        transform: edge === "right" ? "translateX(-100%)" : edge === "left" ? "none" : "translateX(-50%)",
        textAlign: edge === "center" ? "center" : edge,
        display: "flex",
        flexDirection: "column",
        fontSize: 12,
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        maxWidth: 160,
      }}
    >
      <b style={{ fontWeight: 500, color: e.amount > 0 ? "var(--tn-lime)" : "var(--tn-ink)", overflow: "hidden", textOverflow: "ellipsis" }}>{e.label}</b>
      <span className="tn-muted money">
        {shortDate(e.date)} · {e.amount > 0 ? "+" : "−"}
        {dollars(Math.abs(e.amount))}
      </span>
    </div>
  );
}
