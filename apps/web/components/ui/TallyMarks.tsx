import { tallyGroups } from "@tally/core/popView";

/**
 * A count drawn as tally marks (Tally Pop): groups of four strokes with a
 * crossing fifth in --mark-accent, then the strokes left over. Decorative:
 * callers always print the number beside it.
 */
export function TallyMarks({ count, height = 40, max = 15 }: { count: number; height?: number; max?: number }) {
  const { full, rest } = tallyGroups(Math.min(count, max));
  const stroke = Math.max(3, Math.round(height / 9));
  const gap = height * 0.26;
  const groupWidth = gap * 4 + stroke * 2;
  const groups = [...Array.from({ length: full }, () => 4), ...(rest > 0 ? [rest] : [])];
  const width = groups.length * groupWidth + Math.max(0, groups.length - 1) * gap;
  if (groups.length === 0) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="flex-none">
      {groups.map((strokes, g) => {
        const x0 = g * (groupWidth + gap) + stroke;
        const crossed = g < full;
        return (
          <g key={g}>
            {Array.from({ length: strokes }, (_, i) => (
              <line key={i} x1={x0 + i * gap} y1={stroke} x2={x0 + i * gap} y2={height - stroke} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" />
            ))}
            {crossed && (
              <line x1={x0 - stroke * 0.6} y1={height * 0.78} x2={x0 + gap * 3 + stroke * 0.6} y2={height * 0.22} stroke="var(--mark-accent, currentColor)" strokeWidth={stroke} strokeLinecap="round" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
