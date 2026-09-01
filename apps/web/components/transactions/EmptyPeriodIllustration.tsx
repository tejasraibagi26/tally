const DAY_COLS = [30, 40, 50, 60, 70, 80, 90];
const DAY_ROWS = [52, 64];
const HIGHLIGHTED_DAY = { cx: 60, cy: 64 };

const SPARKLES = [
  { cx: 12, cy: 22, duration: "3.6s", delay: "0s" },
  { cx: 109, cy: 32, duration: "4.2s", delay: "0.7s" },
  { cx: 100, cy: 80, duration: "3.9s", delay: "1.4s" },
];

/**
 * Replaces the plain Receipt icon for "no transactions in {month}" — a
 * calendar card that's checked a date and come up empty, rather than a
 * generic empty-inbox icon. Self-contained (unlike EmptyState's icon path,
 * it drives its own pop-in + idle animation) so it drops straight into
 * EmptyState's `illustration` prop. Respects prefers-reduced-motion via the
 * global override in globals.css, same as every other empty-state animation.
 */
export function EmptyPeriodIllustration() {
  return (
    <svg viewBox="0 0 120 96" width={112} height={90} role="presentation" aria-hidden="true">
      {SPARKLES.map((s, i) => (
        <circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r={2}
          fill="var(--brand-border)"
          style={{ animation: `empty-sparkle-drift ${s.duration} ease-in-out ${s.delay} infinite` }}
        />
      ))}
      <g
        style={{
          transformOrigin: "60px 55px",
          animation: "empty-pop 450ms ease-out both, empty-card-tilt 5s ease-in-out 450ms infinite",
        }}
      >
        <rect x={44} y={14} width={6} height={14} rx={3} fill="var(--border-strong)" />
        <rect x={70} y={14} width={6} height={14} rx={3} fill="var(--border-strong)" />
        <rect x={18} y={24} width={84} height={62} rx={12} fill="var(--surface)" stroke="var(--border-strong)" strokeWidth={2} />
        <rect x={30} y={34} width={60} height={8} rx={4} fill="var(--brand)" />
        {DAY_ROWS.flatMap((cy) =>
          DAY_COLS.filter((cx) => !(cx === HIGHLIGHTED_DAY.cx && cy === HIGHLIGHTED_DAY.cy)).map((cx) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.2} fill="var(--border)" />
          )),
        )}
        <circle cx={HIGHLIGHTED_DAY.cx} cy={HIGHLIGHTED_DAY.cy} r={3.5} fill="var(--brand)" />
        <circle
          cx={HIGHLIGHTED_DAY.cx}
          cy={HIGHLIGHTED_DAY.cy}
          r={4}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={1.5}
          style={{ animation: "empty-ring-pulse 2.2s ease-out infinite", transformOrigin: `${HIGHLIGHTED_DAY.cx}px ${HIGHLIGHTED_DAY.cy}px` }}
        />
      </g>
    </svg>
  );
}
