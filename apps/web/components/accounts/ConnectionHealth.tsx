import { AlertTriangle, Check } from "lucide-react";
import { cn } from "@/lib/cn";

export type HealthLevel = "healthy" | "act" | "blocked";

/** Past this many banks the tally gets too long to read at a glance; the number alone carries it. */
const MAX_STROKES = 15;
const STROKE_COLOR: Record<HealthLevel, string> = { healthy: "var(--positive)", act: "var(--warning)", blocked: "var(--negative)" };
const LEVEL_LABEL: Record<HealthLevel, string> = { healthy: "up to date", act: "needs you soon", blocked: "paused" };

/**
 * The Accounts summary's fourth cell: how many banks are connected, as a
 * serif figure like its neighbours, with one tally stroke per bank in its
 * health color -- four upright and a fifth crossing, the brand mark's own
 * grouping. The line under it says the same thing in words, with an icon,
 * so color never carries it alone. Banks arrive sorted most urgent first.
 */
export function ConnectionHealth({ banks }: { banks: { name: string; level: HealthLevel }[] }) {
  const needs = banks.filter((b) => b.level !== "healthy").length;
  const blocked = banks.some((b) => b.level === "blocked");
  const healthy = banks.length - needs;

  return (
    <div className="bg-surface p-[18px_24px] flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
      <span className="text-xs font-medium uppercase tracking-wide text-text-3">Connections</span>
      <div className="flex items-center gap-3">
        <span className="font-display text-3xl tabular text-text">{banks.length}</span>
        {banks.length <= MAX_STROKES && <TallyStrokes banks={banks} />}
      </div>
      <span className="flex items-center gap-1.5 text-[13px] text-text-2">
        {needs === 0 ? (
          <>
            <Check size={14} strokeWidth={2} className="text-positive flex-none" />
            {banks.length === 1 ? "Up to date" : "All up to date"}
          </>
        ) : (
          <>
            <AlertTriangle size={14} strokeWidth={1.9} className={cn("flex-none", blocked ? "text-negative" : "text-warning")} />
            <span className={blocked ? "text-negative" : "text-warning"}>
              {needs} need{needs === 1 ? "s" : ""} you
            </span>
            {healthy > 0 && <span className="text-text-3">· {healthy} up to date</span>}
          </>
        )}
      </span>
    </div>
  );
}

function TallyStrokes({ banks }: { banks: { name: string; level: HealthLevel }[] }) {
  const GROUP_W = 30;
  const groups = Math.ceil(banks.length / 5);
  const width = groups * GROUP_W - 6;
  return (
    <svg width={width} height={26} viewBox={`0 0 ${width} 26`} fill="none" role="img" aria-label={banks.map((b) => `${b.name}: ${LEVEL_LABEL[b.level]}`).join(", ")}>
      {banks.map((b, i) => {
        const g = Math.floor(i / 5);
        const k = i % 5;
        const x0 = g * GROUP_W + 3;
        // Strokes 1–4 stand upright; the fifth crosses the group, as in the logo.
        const line = k < 4 ? { x1: x0 + k * 5, y1: 3, x2: x0 + k * 5, y2: 23 } : { x1: x0 - 2.5, y1: 20.5, x2: x0 + 17.5, y2: 5.5 };
        return (
          <line key={i} {...line} stroke={STROKE_COLOR[b.level]} strokeWidth={2.25} strokeLinecap="round">
            <title>{`${b.name}: ${LEVEL_LABEL[b.level]}`}</title>
          </line>
        );
      })}
    </svg>
  );
}
