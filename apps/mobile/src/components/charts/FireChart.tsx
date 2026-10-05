import { useMemo, useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { ProjectionPoint } from "@tally/core/fireMath";
import { useThemeColors } from "@/theme/useThemeColors";

function compact(c: number): string {
  const d = c / 100;
  if (Math.abs(d) >= 1_000_000) return `$${(d / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(d) >= 1000) return `$${Math.round(d / 1000)}K`;
  return `$${Math.round(d)}`;
}

/**
 * The FIRE projection, built to read in one pass: one solid projected
 * line rising to one labeled target line, a shaded band for returns 1%
 * lower/higher, a "$87K today" start, and the crossing called out with
 * age and year. X-axis is age when known.
 */
export function FireChart({
  mid,
  lo,
  hi,
  target,
  years,
  age,
  startYear,
  height = 180,
}: {
  mid: ProjectionPoint[];
  lo: ProjectionPoint[];
  hi: ProjectionPoint[];
  target: number;
  /** Years to the target, or null when unreachable. */
  years: number | null;
  age: number | null;
  startYear: number;
  height?: number;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);

  const g = useMemo(() => {
    if (width <= 0 || mid.length < 2) return null;
    const padL = 40;
    const padR = 6;
    const padT = 10;
    const padB = 22;
    const xMax = mid[mid.length - 1]!.year;
    const yMax = Math.max(target * 1.15, ...mid.map((p) => p.projectedValue));
    const iw = width - padL - padR;
    const ih = height - padT - padB;
    const X = (t: number) => padL + (iw * t) / xMax;
    const Y = (v: number) => padT + ih * (1 - Math.min(v, yMax) / yMax);
    const line = mid.map((p, i) => `${i ? "L" : "M"}${X(p.year).toFixed(1)},${Y(p.projectedValue).toFixed(1)}`).join(" ");
    const band = `${hi.map((p, i) => `${i ? "L" : "M"}${X(p.year).toFixed(1)},${Y(p.projectedValue).toFixed(1)}`).join(" ")} ${[...lo].reverse().map((p) => `L${X(p.year).toFixed(1)},${Y(p.projectedValue).toFixed(1)}`).join(" ")} Z`;
    const ticks = [0, target / 2, target];
    const xTicks = [0, Math.round(xMax / 2), xMax];
    return { X, Y, line, band, ticks, xTicks, padL, padR, padB };
  }, [width, mid, lo, hi, target, height]);

  const label = (t: number) => (age != null ? (t === 0 ? "Now" : String(age + t)) : t === 0 ? "Now" : `+${t}y`);
  const crossLabel = years != null ? (age != null ? `Retire at ${Math.floor(age + years)}` : `Retire in ${startYear + Math.round(years)}`) : null;

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityLabel={crossLabel ? `${crossLabel}, ${startYear + Math.round(years!)}` : "Projection"}>
      {g && (
        <Svg width={width} height={height}>
          {g.ticks.map((t) => (
            <Line key={`g${t}`} x1={g.padL} x2={width - g.padR} y1={g.Y(t)} y2={g.Y(t)} stroke={colors.border} strokeWidth={1} />
          ))}
          {g.ticks.map((t) => (
            <SvgText key={`y${t}`} x={g.padL - 6} y={g.Y(t) + 4} fontSize={10} fill={colors["text-3"]} textAnchor="end">
              {compact(t)}
            </SvgText>
          ))}
          {g.xTicks.map((t, i) => (
            <SvgText key={`x${t}`} x={g.X(t)} y={height - 6} fontSize={10} fill={colors["text-3"]} textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}>
              {label(t)}
            </SvgText>
          ))}
          <Path d={g.band} fill={colors.brand} opacity={0.12} />
          <Line x1={g.padL} x2={width - g.padR} y1={g.Y(target)} y2={g.Y(target)} stroke={colors.positive} strokeWidth={1.5} />
          <SvgText x={g.padL + 4} y={g.Y(target) - 6} fontSize={10.5} fontWeight="600" fill={colors.positive}>
            {`Target ${compact(target)}`}
          </SvgText>
          <Path d={g.line} fill="none" stroke={colors.brand} strokeWidth={2.5} strokeLinejoin="round" />
          <Circle cx={g.X(0) + 1} cy={g.Y(mid[0]!.projectedValue)} r={4} fill={colors.brand} stroke={colors.surface} strokeWidth={2} />
          {years != null && years > 0 && years <= mid[mid.length - 1]!.year && crossLabel && (
            <>
              <Line x1={g.X(years)} x2={g.X(years)} y1={g.Y(target)} y2={height - g.padB} stroke={colors.positive} strokeWidth={1} strokeDasharray="3 3" />
              <Circle cx={g.X(years)} cy={g.Y(target)} r={5} fill={colors.positive} stroke={colors.surface} strokeWidth={2} />
              <Rect x={Math.max(g.padL, g.X(years) - 104)} y={g.Y(target) + 10} width={96} height={32} rx={8} fill={colors.raised} stroke={colors.border} />
              <SvgText x={Math.max(g.padL, g.X(years) - 104) + 9} y={g.Y(target) + 24} fontSize={11} fontWeight="600" fill={colors.text}>
                {crossLabel}
              </SvgText>
              <SvgText x={Math.max(g.padL, g.X(years) - 104) + 9} y={g.Y(target) + 37} fontSize={10} fill={colors["text-3"]}>
                {`in ${startYear + Math.round(years)}`}
              </SvgText>
            </>
          )}
        </Svg>
      )}
    </View>
  );
}
