import Link from "next/link";
import { CHANGELOG, type ChangeKind } from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";

// Reached only from the version line at the bottom of Settings -- not in
// the nav or any menu, on purpose (see lib/changelog.ts).
// Changes are grouped under one label per kind (not a tag on every line),
// so every line of text starts at the same edge.
const KIND_ORDER: ChangeKind[] = ["new", "improved", "fixed"];
const KIND_STYLE: Record<ChangeKind, { label: string; dot: string; text: string }> = {
  new: { label: "New", dot: "bg-brand", text: "text-brand" },
  improved: { label: "Improved", dot: "bg-info", text: "text-info" },
  fixed: { label: "Fixed", dot: "bg-text-3", text: "text-text-2" },
};

function formatDate(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function ChangelogPage() {
  return (
    <div className="max-w-[720px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/settings" className="text-[13.5px] text-text-3 hover:text-text-2 self-start">
          ← Settings
        </Link>
        <h1 className="text-2xl font-semibold text-text">Changelog</h1>
        <p className="text-[13.5px] text-text-2">You&apos;re on v{APP_VERSION}.</p>
      </div>

      <ol className="flex flex-col">
        {CHANGELOG.map((entry, i) => (
          <li
            key={entry.version}
            className={`grid grid-cols-1 sm:grid-cols-[148px_minmax(0,1fr)] gap-x-8 gap-y-3 py-7 ${i > 0 ? "border-t border-border" : ""}`}
          >
            {/* Left rail: version, date, current marker -- stacks above the
                changes on narrow screens. */}
            <div className="flex sm:flex-col items-baseline sm:items-start gap-x-3 gap-y-1">
              <span className="font-mono text-[15px] font-medium text-text">v{entry.version}</span>
              <span className="text-[13px] text-text-3">{formatDate(entry.date)}</span>
              {entry.version === APP_VERSION && (
                <span className="sm:mt-1.5 inline-flex px-2 py-0.5 rounded-full bg-positive-subtle text-positive text-[11.5px] font-medium">Current</span>
              )}
            </div>
            <div className="flex flex-col gap-5">
              {KIND_ORDER.filter((kind) => entry.changes.some((c) => c.kind === kind)).map((kind) => (
                <section key={kind} className="flex flex-col gap-2">
                  <h2 className={`m-0 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.06em] ${KIND_STYLE[kind].text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${KIND_STYLE[kind].dot}`} />
                    {KIND_STYLE[kind].label}
                  </h2>
                  <ul className="m-0 p-0 list-none flex flex-col gap-2">
                    {entry.changes
                      .filter((c) => c.kind === kind)
                      .map((c) => (
                        <li key={c.text} className="text-[14.5px] leading-[1.6] text-text max-w-[60ch]">
                          {c.text}
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
