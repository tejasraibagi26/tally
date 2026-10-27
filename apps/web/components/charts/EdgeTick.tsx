/**
 * An x-axis tick for charts that run edge to edge of their card: the first
 * label is anchored to its left edge and the last to its right, so neither
 * hangs off the card. Pass `format` for the label text.
 */
export function EdgeTick({
  x,
  y,
  payload,
  index,
  visibleTicksCount,
  format,
  fontSize = 11,
}: {
  x?: number;
  y?: number;
  payload?: { value: string | number };
  index?: number;
  visibleTicksCount?: number;
  format: (value: string | number) => string;
  fontSize?: number;
}) {
  if (x == null || y == null || payload == null) return null;
  const last = (visibleTicksCount ?? 0) - 1;
  const anchor = index === 0 ? "start" : index === last ? "end" : "middle";
  // 8px in from the card edge, matching the label padding elsewhere.
  const dx = anchor === "start" ? 8 : anchor === "end" ? -8 : 0;
  return (
    <text x={x + dx} y={y} dy={12} textAnchor={anchor} fill="var(--text-3)" fontSize={fontSize}>
      {format(payload.value)}
    </text>
  );
}
