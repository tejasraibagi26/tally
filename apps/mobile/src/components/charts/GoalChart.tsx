import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { formatCents } from "@tally/core/money";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

const HEIGHT = 190;
const TOP = 26; // room for the target label above its line
const BOTTOM = 22; // room for the date labels

export interface GoalChartPoint {
  asOfDate: string;
  net: number;
}

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Mobile's copy of web's components/goals/GoalChart.tsx: net worth so far
 * (line + area), the projection to the deadline (dashed), the target (a
 * labelled line), first and last dates. Press and drag to read any point --
 * the readout above names the date and the value (projected past today).
 * Amounts follow "hide amounts" (a goal is net worth).
 */
export function GoalChart({
  points,
  projected,
  deadline,
  target,
  onScrubbingChange,
}: {
  points: GoalChartPoint[];
  projected: number | null;
  deadline: string;
  target: number;
  onScrubbingChange: (scrubbing: boolean) => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const { hidden } = usePrivacy();
  const money = (c: number) => (hidden ? "••••••" : formatCents(Math.round(c)));
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number | null>(null);

  // What can be scrubbed: every recorded day, then the projected deadline.
  const series = useMemo(
    () => [...points.map((p) => ({ date: p.asOfDate, value: p.net, projected: false })), ...(projected != null && deadline > (points.at(-1)?.asOfDate ?? "") ? [{ date: deadline, value: projected, projected: true }] : [])],
    [points, projected, deadline],
  );

  const geo = useMemo(() => {
    if (width <= 0 || series.length < 2) return null;
    const t = (d: string) => Date.parse(`${d}T00:00:00Z`);
    const x0 = t(series[0]!.date);
    const x1 = t(series.at(-1)!.date);
    const values = [...series.map((s) => s.value), target];
    const lo = Math.min(...values) * 0.98;
    const hi = Math.max(...values) * 1.02;
    const X = (d: string) => ((t(d) - x0) / (x1 - x0 || 1)) * width;
    const Y = (v: number) => TOP + (1 - (v - lo) / (hi - lo || 1)) * (HEIGHT - TOP - BOTTOM);
    const actual = series.filter((s) => !s.projected);
    const line = actual.map((s, i) => `${i === 0 ? "M" : "L"}${X(s.date).toFixed(1)},${Y(s.value).toFixed(1)}`).join(" ");
    const lastActual = actual.at(-1)!;
    const area = `${line} L${X(lastActual.date).toFixed(1)},${HEIGHT - BOTTOM} L${X(actual[0]!.date).toFixed(1)},${HEIGHT - BOTTOM} Z`;
    const proj = series.at(-1)!.projected ? `M${X(lastActual.date).toFixed(1)},${Y(lastActual.value).toFixed(1)} L${X(deadline).toFixed(1)},${Y(series.at(-1)!.value).toFixed(1)}` : null;
    return { X, Y, line, area, proj, targetY: Y(target) };
  }, [width, series, target, deadline]);

  // Same touch handling as PortfolioChart: the responder reads the latest
  // width and series through a ref, created once.
  const live = useRef({ width, count: series.length, onScrubbingChange });
  useEffect(() => {
    live.current = { width, count: series.length, onScrubbingChange };
  });
  const pageX = useRef(0);
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    const scrubAt = (localX: number) => {
      const { width: w, count } = live.current;
      if (w <= 0 || count < 2) return;
      setIndex(Math.max(0, Math.min(count - 1, Math.round((Math.max(0, Math.min(w, localX)) / w) * (count - 1)))));
    };
    const end = () => {
      setIndex(null);
      live.current.onScrubbingChange(false);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        live.current.onScrubbingChange(true);
        pageX.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
        scrubAt(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (_evt, g) => scrubAt(g.moveX - pageX.current),
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  });

  const at = index != null ? series[index] : null;
  const shown = at ?? series.at(-1);

  return (
    <View className="gap-2">
      {/* The readout: the scrubbed point, else the latest one. */}
      <View className="px-5 flex-row items-baseline justify-between">
        <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
          {shown ? `${shortDate(shown.date)} · ${shown.projected ? "projected" : "net worth"}` : ""}
        </Text>
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15), fontVariant: ["tabular-nums"] }}>{shown ? money(shown.value) : ""}</Text>
      </View>
      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
        accessible
        accessibilityLabel={`Net worth so far and the projection to ${shortDate(deadline)}. Press and drag to read a point.`}
      >
        {geo && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <LinearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.brand} stopOpacity={0.22} />
                <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Line x1={0} x2={width} y1={geo.targetY} y2={geo.targetY} stroke={colors.positive} strokeWidth={1.5} />
            <SvgText x={8} y={geo.targetY - 6} fill={colors.positive} fontSize={11} fontWeight="600">
              {`Target ${money(target)}`}
            </SvgText>
            <Path d={geo.area} fill="url(#goalFill)" />
            <Path d={geo.line} fill="none" stroke={colors.brand} strokeWidth={2.5} strokeLinejoin="round" />
            {geo.proj && <Path d={geo.proj} fill="none" stroke={colors.brand} strokeWidth={2} strokeDasharray="5 5" />}
            {at && (
              <>
                <Line x1={geo.X(at.date)} x2={geo.X(at.date)} y1={TOP - 6} y2={HEIGHT - BOTTOM} stroke={colors["text-3"]} strokeWidth={1} strokeDasharray="2 3" />
                <Circle cx={geo.X(at.date)} cy={geo.Y(at.value)} r={4.5} fill={colors.brand} stroke={colors.surface} strokeWidth={2} />
              </>
            )}
            <SvgText x={8} y={HEIGHT - 6} fill={colors["text-3"]} fontSize={11}>{shortDate(series[0]!.date)}</SvgText>
            <SvgText x={width - 8} y={HEIGHT - 6} fill={colors["text-3"]} fontSize={11} textAnchor="end">{shortDate(series.at(-1)!.date)}</SvgText>
          </Svg>
        )}
      </View>
    </View>
  );
}
