import Link from "next/link";
import { formatCents } from "@/lib/money";

export interface RankedBarRow {
  key: string;
  label: string;
  colorSlot: number;
  total: number;
  href: string;
}

// DESIGN.md §7.2: "Spend by category" -> ranked horizontal bars, value direct-labeled. Never a donut/pie.
export function RankedBars({ rows, limit = 6 }: { rows: RankedBarRow[]; limit?: number }) {
  const top = rows.slice(0, limit);
  const max = top.reduce((m, r) => Math.max(m, r.total), 0) || 1;

  if (top.length === 0) {
    return <div className="px-4 py-8 text-center text-text-2 text-[15px]">No spend in this period yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {top.map((row) => (
        <Link key={row.key} href={row.href} className="flex items-center gap-3 group">
          <span className="w-[104px] flex-none text-[13.5px] text-text truncate">{row.label}</span>
          <span className="flex-1 h-5 rounded-[4px] bg-sunken overflow-hidden">
            <span
              className="block h-full rounded-[4px] group-hover:opacity-80 transition-opacity"
              style={{ width: `${(row.total / max) * 100}%`, background: `var(--series-${row.colorSlot})` }}
            />
          </span>
          <span className="w-20 flex-none text-right text-[13.5px] text-text tabular money">{formatCents(row.total)}</span>
        </Link>
      ))}
    </div>
  );
}
