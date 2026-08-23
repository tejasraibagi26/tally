"use client";

/**
 * Full-viewport blocking overlay for the gap between "Plaid Link's own modal
 * closed" and "the app has actually finished pulling data" — a stretch that
 * used to have zero feedback, which reads as the app being stuck rather than
 * working. Built to DESIGN.md §8's Modal spec (480px, radius 16, --canvas
 * scrim at 60%) with a staggered fade-dot trio, matching the app's existing
 * fade animation language (app/globals.css) instead of a spinner —
 * DESIGN.md §8 is explicit: "never a centered spinner on a full page."
 */
export function LoadingOverlay({ message }: { message: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "color-mix(in srgb, var(--canvas) 60%, transparent)" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 bg-surface border border-border rounded-[16px] shadow-overlay px-8 py-7 w-[360px] max-w-full text-center">
        <div className="flex items-center gap-2" aria-hidden="true">
          {[0, 0.2, 0.4].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-brand"
              style={{ animation: `fade-dot 1.4s ease-in-out ${delay}s infinite` }}
            />
          ))}
        </div>
        <span className="text-[15px] text-text">{message}</span>
      </div>
    </div>
  );
}
