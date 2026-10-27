import Svg, { G, Line } from "react-native-svg";
import { tallyGroups } from "@tally/core/popView";

/**
 * A count drawn as tally marks (Tally Pop): groups of four strokes with a
 * crossing fifth in `accent`, then the strokes left over. Mobile's copy of
 * web's components/ui/TallyMarks.tsx. Decorative: callers always print the
 * number beside it.
 */
export function TallyMarks({ count, color, accent, height = 40, max = 15 }: { count: number; color: string; accent: string; height?: number; max?: number }) {
  const { full, rest } = tallyGroups(Math.min(count, max));
  const stroke = Math.max(3, Math.round(height / 9));
  const gap = height * 0.26;
  const groupWidth = gap * 4 + stroke * 2;
  const groups = [...Array.from({ length: full }, () => 4), ...(rest > 0 ? [rest] : [])];
  if (groups.length === 0) return null;
  const width = groups.length * groupWidth + (groups.length - 1) * gap;
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {groups.map((strokes, g) => {
        const x0 = g * (groupWidth + gap) + stroke;
        return (
          <G key={g}>
            {Array.from({ length: strokes }, (_, i) => (
              <Line key={i} x1={x0 + i * gap} y1={stroke} x2={x0 + i * gap} y2={height - stroke} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
            ))}
            {g < full && <Line x1={x0 - stroke * 0.6} y1={height * 0.78} x2={x0 + gap * 3 + stroke * 0.6} y2={height * 0.22} stroke={accent} strokeWidth={stroke} strokeLinecap="round" />}
          </G>
        );
      })}
    </Svg>
  );
}
