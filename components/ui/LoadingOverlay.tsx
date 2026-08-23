"use client";

/**
 * Full-viewport blocking overlay for the gap between "Plaid Link's own modal
 * closed" and "the app has actually finished pulling data" — a stretch that
 * used to just be a button reading "Connecting…" with no other feedback,
 * which reads as the app being stuck rather than working.
 */
export function LoadingOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4 bg-surface border border-border rounded-card shadow-overlay px-8 py-7 max-w-sm text-center">
        <span className="w-8 h-8 border-2 border-border-strong border-t-brand rounded-full animate-spin" aria-hidden />
        <span className="text-[15px] text-text">{message}</span>
      </div>
    </div>
  );
}
