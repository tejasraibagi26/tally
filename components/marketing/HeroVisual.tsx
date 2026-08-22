"use client";

import { useEffect, useRef, useState } from "react";
import { formatCents } from "@/lib/money";

const TARGET_CENTS = 84_231_855; // $842,318.55 — illustrative only, never real user data
const SPARK_POINTS = "0,38 12,34 24,36 36,26 48,29 60,18 72,21 84,10 96,13 108,2";
const DOTS = [1, 3, 5, 2, 7, 4] as const;

function useCountUp(target: number, durationMs = 1600) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const start = performance.now();
    let frame: number;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out-cubic
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

export function HeroVisual() {
  const value = useCountUp(TARGET_CENTS);

  return (
    <div className="relative w-full max-w-[420px] mx-auto">
      {DOTS.map((slot, i) => (
        <span
          key={i}
          className="absolute w-2.5 h-2.5 rounded-full"
          style={{
            background: `var(--series-${slot})`,
            top: `${[-6, 14, 92, 8, 70, 96][i]}%`,
            left: `${[8, 96, -4, 102, 100, 40][i]}%`,
            animation: `float-dot ${3.2 + i * 0.4}s ease-in-out ${i * 0.3}s infinite`,
            opacity: 0.85,
          }}
          aria-hidden
        />
      ))}

      <div className="relative bg-surface border border-border rounded-card shadow-overlay p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Net worth</span>
          <span className="flex items-center gap-1.5 text-[11px] text-text-3">
            <span className="w-1.5 h-1.5 rounded-full bg-positive" style={{ animation: "float-dot 1.8s ease-in-out infinite" }} />
            Live
          </span>
        </div>

        <span className="font-display text-[44px] leading-none text-text tabular">{formatCents(value)}</span>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full text-positive bg-positive-subtle">
            <span aria-hidden>▲</span> 12.4% vs last month
          </span>
        </div>

        <svg viewBox="0 0 108 40" className="w-full h-12" preserveAspectRatio="none" aria-hidden>
          <polyline
            points={SPARK_POINTS}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: 1,
              animation: "draw-line 1.4s ease-out 0.3s forwards",
            }}
          />
        </svg>

        <div className="h-px bg-border" />

        <div className="flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 text-text-2">
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: "var(--series-3)" }} />
            Budget this month
          </span>
          <span className="text-text-2 tabular">68% used</span>
        </div>
        <div className="h-1.5 rounded-full bg-sunken overflow-hidden -mt-2">
          <div
            className="h-full rounded-full"
            style={{ background: "var(--series-3)", width: 0, animation: "grow-bar 1.2s ease-out 0.6s forwards" }}
          />
        </div>
      </div>
    </div>
  );
}
