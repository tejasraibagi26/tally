"use client";

/**
 * Full-viewport blocking overlay for the gap between "Plaid Link's own modal
 * closed" and "the app has actually finished pulling data" — a stretch that
 * used to have zero feedback, which reads as the app being stuck rather than
 * working. Built to DESIGN.md §8's Modal spec (480px, radius 16, --canvas
 * scrim at 60%). The indicator is a single brand-colored bar sliding across
 * a track (see app/globals.css's indeterminate-slide) — DESIGN.md §8
 * explicitly rules out "a centered spinner on a full page."
 */
export function LoadingOverlay({ message }: { message: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "color-mix(in srgb, var(--canvas) 60%, transparent)" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-5 bg-surface border border-border rounded-[16px] shadow-overlay px-8 py-7 w-[360px] max-w-full text-center">
        <div className="relative w-40 h-1.5 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
          <span
            className="absolute inset-y-0 w-1/3 rounded-full"
            style={{
              background: "var(--brand)",
              animation: "indeterminate-slide 1.3s cubic-bezier(.4,0,.2,1) infinite",
            }}
          />
        </div>
        <span className="text-[15px] text-text">{message}</span>
      </div>
    </div>
  );
}
