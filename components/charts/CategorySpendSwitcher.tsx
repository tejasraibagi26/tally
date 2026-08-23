"use client";

import { useState } from "react";
import Link from "next/link";
import { Rows3, LayoutGrid } from "lucide-react";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/cn";
import type { RankedBarRow } from "./RankedBars";

type View = "stacked" | "treemap";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  row: RankedBarRow;
}

/** Squarified treemap (Bruls/Huizing/van Wijk) laid out in a normalized W x H space. */
function squarify(rows: RankedBarRow[], x: number, y: number, w: number, h: number): Rect[] {
  const values = rows.map((r) => Math.max(r.total, 1));
  const area = w * h;
  const total = values.reduce((s, v) => s + v, 0) || 1;
  const scaled = values.map((v) => (v / total) * area);

  const worst = (row: number[], side: number) => {
    const sum = row.reduce((a, b) => a + b, 0);
    const max = Math.max(...row);
    const min = Math.min(...row);
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const layoutRow = (row: number[], rowRows: RankedBarRow[], rx: number, ry: number, rw: number, rh: number, horizontal: boolean) => {
    const sum = row.reduce((a, b) => a + b, 0);
    const rects: Rect[] = [];
    let offset = 0;
    if (horizontal) {
      const rowH = sum / rw;
      row.forEach((v, i) => {
        const cw = v / rowH;
        rects.push({ x: rx + offset, y: ry, w: cw, h: rowH, row: rowRows[i]! });
        offset += cw;
      });
      return { rects, next: { x: rx, y: ry + rowH, w: rw, h: rh - rowH } };
    } else {
      const rowW = sum / rh;
      row.forEach((v, i) => {
        const ch = v / rowW;
        rects.push({ x: rx, y: ry + offset, w: rowW, h: ch, row: rowRows[i]! });
        offset += ch;
      });
      return { rects, next: { x: rx + rowW, y: ry, w: rw - rowW, h: rh } };
    }
  };

  const result: Rect[] = [];
  let remainingVals = scaled.slice();
  let remainingRows = rows.slice();
  let rect = { x, y, w, h };
  let row: number[] = [];
  let rowRows: RankedBarRow[] = [];

  while (remainingVals.length) {
    const side = Math.min(rect.w, rect.h);
    const next = remainingVals[0]!;
    const nextRow = [...row, next];
    if (row.length === 0 || worst(row, side) >= worst(nextRow, side)) {
      row = nextRow;
      rowRows = [...rowRows, remainingRows[0]!];
      remainingVals = remainingVals.slice(1);
      remainingRows = remainingRows.slice(1);
    } else {
      const horizontal = rect.w >= rect.h;
      const { rects, next: nextRect } = layoutRow(row, rowRows, rect.x, rect.y, rect.w, rect.h, horizontal);
      result.push(...rects);
      rect = nextRect;
      row = [];
      rowRows = [];
    }
  }
  if (row.length) {
    const horizontal = rect.w >= rect.h;
    const { rects } = layoutRow(row, rowRows, rect.x, rect.y, rect.w, rect.h, horizontal);
    result.push(...rects);
  }
  return result;
}

const SPACE_W = 240;
const SPACE_H = 130;

function Legend({ rows }: { rows: RankedBarRow[] }) {
  return (
    <div className="flex flex-col gap-1.5 px-4 pb-4">
      {rows.map((row) => (
        <Link key={row.key} href={row.href} className="flex items-center gap-2 group">
          <span className="w-2 h-2 rounded-full flex-none" style={{ background: `var(--series-${row.colorSlot})` }} />
          <span className="flex-1 text-[13.5px] text-text truncate group-hover:underline">{row.label}</span>
          <span className="text-[13.5px] text-text-2 tabular money flex-none">{formatCents(row.total)}</span>
        </Link>
      ))}
    </div>
  );
}

function StackedBar({ rows }: { rows: RankedBarRow[] }) {
  const total = rows.reduce((s, r) => s + r.total, 0) || 1;
  return (
    <div className="px-4 pt-4">
      <div className="flex h-7 gap-[2px] rounded-[6px] overflow-hidden">
        {rows.map((row) => (
          <Link
            key={row.key}
            href={row.href}
            title={`${row.label}: ${formatCents(row.total)}`}
            className="h-full hover:opacity-80 transition-opacity"
            style={{ width: `${(row.total / total) * 100}%`, background: `var(--series-${row.colorSlot})` }}
          />
        ))}
      </div>
    </div>
  );
}

function Treemap({ rows }: { rows: RankedBarRow[] }) {
  const rects = squarify(rows, 0, 0, SPACE_W, SPACE_H);
  const totalArea = SPACE_W * SPACE_H;
  const labelThreshold = totalArea * 0.05;

  return (
    <div className="px-4 pt-4">
      <div className="relative w-full" style={{ paddingTop: `${(SPACE_H / SPACE_W) * 100}%` }}>
        <div className="absolute inset-0">
          {rects.map((r) => {
            const area = r.w * r.h;
            const showLabel = area >= labelThreshold;
            return (
              <Link
                key={r.row.key}
                href={r.row.href}
                title={`${r.row.label}: ${formatCents(r.row.total)}`}
                className="absolute flex flex-col items-start justify-end p-1.5 overflow-hidden hover:opacity-90 transition-opacity"
                style={{
                  left: `${(r.x / SPACE_W) * 100}%`,
                  top: `${(r.y / SPACE_H) * 100}%`,
                  width: `${(r.w / SPACE_W) * 100}%`,
                  height: `${(r.h / SPACE_H) * 100}%`,
                  padding: 1,
                }}
              >
                <span
                  className="w-full h-full rounded-[3px] flex flex-col items-start justify-end p-1.5 overflow-hidden"
                  style={{ background: `var(--series-${r.row.colorSlot})` }}
                >
                  {showLabel && (
                    <>
                      <span className="text-[11.5px] font-medium text-white leading-tight truncate w-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
                        {r.row.label}
                      </span>
                      <span className="text-[11px] text-white/90 tabular money leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
                        {formatCents(r.row.total)}
                      </span>
                    </>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CategorySpendSwitcher({ rows, limit = 6 }: { rows: RankedBarRow[]; limit?: number }) {
  const [view, setView] = useState<View>("stacked");
  const top = rows.slice(0, limit);

  if (top.length === 0) {
    return <div className="px-4 py-8 text-center text-text-2 text-[15px]">No spend in this period yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3 pb-1">
      <div className="flex justify-end px-4 pt-3">
        <div className="inline-flex items-center gap-0.5 bg-sunken rounded-full p-0.5">
          <button
            type="button"
            onClick={() => setView("stacked")}
            aria-pressed={view === "stacked"}
            title="Stacked bar"
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
              view === "stacked" ? "bg-surface text-text shadow-raised" : "text-text-2 hover:text-text",
            )}
          >
            <Rows3 size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setView("treemap")}
            aria-pressed={view === "treemap"}
            title="Treemap"
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
              view === "treemap" ? "bg-surface text-text shadow-raised" : "text-text-2 hover:text-text",
            )}
          >
            <LayoutGrid size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      {view === "stacked" ? <StackedBar rows={top} /> : <Treemap rows={top} />}
      <Legend rows={top} />
    </div>
  );
}
