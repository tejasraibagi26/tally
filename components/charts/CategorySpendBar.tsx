import Link from "next/link";
import { formatCents } from "@/lib/money";

export interface RankedBarRow {
  key: string;
  label: string;
  colorSlot: number;
  total: number;
  href: string;
}

// DESIGN.md §7.2 "Portfolio allocation" pattern reused here: one stacked horizontal bar, 2px gaps, labeled legend.
export function CategorySpendBar({ rows, limit = 6 }: { rows: RankedBarRow[]; limit?: number }) {
  const top = rows.slice(0, limit);
  const total = top.reduce((s, r) => s + r.total, 0) || 1;

  if (top.length === 0) {
    return <div className="px-4 py-8 text-center text-text-2 text-[15px]">No spend in this period yet.</div>;
  }

  return (
    <div className="flex flex-col gap-3 pt-4 pb-1">
      <div className="px-4">
        <div className="flex h-7 gap-[2px] rounded-[6px] overflow-hidden">
          {top.map((row) => (
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
      <div className="flex flex-col gap-1.5 px-4 pb-4">
        {top.map((row) => (
          <Link key={row.key} href={row.href} className="flex items-center gap-2 group">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: `var(--series-${row.colorSlot})` }} />
            <span className="flex-1 text-[13.5px] text-text truncate group-hover:underline">{row.label}</span>
            <span className="text-[13.5px] text-text-2 tabular money flex-none">{formatCents(row.total)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
