import Link from "next/link";
import { CHANGELOG, type ChangeKind } from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";

// Reached only from the version line at the bottom of Settings -- not in
// the nav or any menu, on purpose (see lib/changelog.ts).
const KIND_STYLE: Record<ChangeKind, { label: string; className: string }> = {
  new: { label: "New", className: "bg-brand-subtle text-brand" },
  improved: { label: "Improved", className: "bg-info-subtle text-info" },
  fixed: { label: "Fixed", className: "bg-sunken text-text-2" },
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
          <li key={entry.version} className={`flex flex-col gap-2.5 py-5 ${i > 0 ? "border-t border-border" : ""}`}>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[14px] font-medium text-text">v{entry.version}</span>
              <span className="text-[13px] text-text-3">{formatDate(entry.date)}</span>
              {entry.version === APP_VERSION && <span className="text-[12px] font-medium text-positive">Current</span>}
            </div>
            <ul className="flex flex-col gap-2">
              {entry.changes.map((c) => (
                <li key={c.text} className="flex items-start gap-2.5">
                  <span className={`flex-none mt-px px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium ${KIND_STYLE[c.kind].className}`}>
                    {KIND_STYLE[c.kind].label}
                  </span>
                  <span className="text-[14px] leading-relaxed text-text-2">{c.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
