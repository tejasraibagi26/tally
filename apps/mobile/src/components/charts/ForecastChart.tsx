import { useMemo, useState } from "react";
import { useColorScheme } from "nativewind";
import { Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { formatCents } from "@tally/core/money";
import type { ForecastDay } from "@tally/core/forecast";
import { usePrivacy } from "@/lib/PrivacyContext";
import { chartSeries } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

const HEIGHT = 170;
const TOP = 14;
const BOTTOM = 22; // room for the date labels

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Mobile's copy of web's components/forecast/ForecastChart.tsx: the
 * projected balance as a line, the likely range of day-to-day spending as a
 * band behind it, the buffer as a dashed line and the first short day as a
 * dot. Same forms as web, shortened — MOBILE_DESIGN.md's rule is to keep the
 * form and drop detail, never to change the chart because it's narrow.
 *
 * No scrub gesture yet (web has a crosshair): the ledger below the chart
 * carries every figure, so this is the one place mobile is thinner.
 */
export function ForecastChart({ days, cushion, shortfallDate }: { days: ForecastDay[]; cushion: number; shortfallDate?: string | null }) {
  const colors = useThemeColors();
  const rf = useRF();
  const { hidden } = usePrivacy();
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const [width, setWidth] = useState(0);
  // DESIGN.md §7.1 slot 1, the same hue web's balance line uses.
  const series1 = chartSeries[scheme][0]!;

  const geo = useMemo(() => {
    if (width <= 0 || days.length < 2) return null;
    const values = [...days.map((d) => d.lo), ...days.map((d) => d.hi), cushion, 0];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const X = (i: number) => (i / (days.length - 1)) * width;
    const Y = (v: number) => TOP + (1 - (v - lo) / span) * (HEIGHT - TOP - BOTTOM);

    const line = days.map((d, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(d.balance).toFixed(1)}`).join(" ");
    const banded = days.some((d) => d.lo !== d.balance);
    const band = banded
      ? `${days.map((d, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(d.hi).toFixed(1)}`).join(" ")} ${[...days]
          .reverse()
          .map((d, i) => `L${X(days.length - 1 - i).toFixed(1)},${Y(d.lo).toFixed(1)}`)
          .join(" ")} Z`
      : null;

    const dipIndex = shortfallDate ? days.findIndex((d) => d.date === shortfallDate) : -1;
    return { X, Y, line, band, zeroY: Y(0), cushionY: Y(cushion), dipIndex };
  }, [width, days, cushion, shortfallDate]);

  const money = (c: number) => (hidden ? "•••" : formatCents(c));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {geo && (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={series1} stopOpacity={0.22} />
              <Stop offset="1" stopColor={series1} stopOpacity={0.08} />
            </LinearGradient>
          </Defs>
          {geo.band && <Path d={geo.band} fill="url(#forecastBand)" />}
          <Line x1={0} y1={geo.zeroY} x2={width} y2={geo.zeroY} stroke={colors["text-3"]} strokeWidth={1} />
          {cushion > 0 && (
            <Line x1={0} y1={geo.cushionY} x2={width} y2={geo.cushionY} stroke={colors.brand} strokeWidth={1.2} strokeDasharray="4,3" />
          )}
          <Path d={geo.line} fill="none" stroke={series1} strokeWidth={2.5} strokeLinejoin="round" />
          {geo.dipIndex >= 0 && (
            <Circle
              cx={geo.X(geo.dipIndex)}
              cy={geo.Y(days[geo.dipIndex]!.balance)}
              r={5}
              fill={colors["status-critical"]}
              stroke={colors.surface}
              strokeWidth={2}
            />
          )}
          <SvgText x={0} y={HEIGHT - 6} fill={colors["text-3"]} fontSize={rf(10)} fontFamily="Figtree">
            {shortDate(days[0]!.date)}
          </SvgText>
          <SvgText x={width} y={HEIGHT - 6} fill={colors["text-3"]} fontSize={rf(10)} textAnchor="end" fontFamily="Figtree">
            {shortDate(days.at(-1)!.date)}
          </SvgText>
        </Svg>
      )}
      {cushion > 0 && (
        <Text className="font-ui text-text-3 mt-1" style={{ fontSize: rf(11) }}>
          Dashed line is your {money(cushion)} buffer
        </Text>
      )}
    </View>
  );
}
