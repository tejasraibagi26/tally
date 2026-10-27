import Link from "next/link";

/**
 * The footer under a table that scrolls inside its own card: what's on
 * screen out of the whole set, and the two steps through it. Sits outside
 * the scroll area (flex-none), so it stays put while the rows move.
 *
 * Paging is a link, not state: the page lives in the URL (`hrefFor`), so a
 * page survives a refresh and the server renders only the rows it needs.
 */
export function Pager({
  page,
  totalPages,
  start,
  end,
  total,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  /** 1-based index of the first row on this page (0 when there are none). */
  start: number;
  end: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const atStart = page <= 1;
  const atEnd = page >= totalPages;
  return (
    <div className="flex items-center justify-between px-4 py-3 text-[13.5px] text-text-3 flex-none border-t border-border">
      <span>
        Showing {start}–{end} of {total}
      </span>
      <div className="flex gap-3">
        <Link href={hrefFor(Math.max(1, page - 1))} aria-disabled={atStart || undefined} className={atStart ? "pointer-events-none text-text-3" : "text-text-2"}>
          Previous
        </Link>
        <Link href={hrefFor(Math.min(totalPages, page + 1))} aria-disabled={atEnd || undefined} className={atEnd ? "pointer-events-none text-text-3" : "text-text-2"}>
          Next
        </Link>
      </div>
    </div>
  );
}
