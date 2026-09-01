"use client";

import { useState } from "react";
import { formatCents } from "@tally/core/money";

export interface ActivityRow {
  id: string;
  date: string;
  name: string | null;
  ticker: string | null;
  subtype: string | null;
  amount: number;
}

const PAGE_SIZE = 8;

export function RecentActivityList({ activity }: { activity: ActivityRow[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(activity.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = activity.slice(start, start + PAGE_SIZE);

  return (
    <>
      {pageRows.map((tx) => (
        <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
          <span className="font-mono text-[13px] text-text-3 tabular w-24 flex-none">{tx.date}</span>
          <span className="text-[15px] text-text flex-1 min-w-0 truncate">
            {tx.name}
            {tx.ticker && <span className="text-text-3"> · {tx.ticker}</span>}
          </span>
          <span className="text-xs text-text-3">{tx.subtype}</span>
          <span className={`text-right text-[15px] tabular money ${tx.amount < 0 ? "text-positive" : "text-text"}`}>
            {formatCents(tx.amount, { signed: true })}
          </span>
        </div>
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 text-[13.5px] text-text-3">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={page <= 1 ? "pointer-events-none text-text-3" : "text-text-2"}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={page >= totalPages ? "pointer-events-none text-text-3" : "text-text-2"}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
