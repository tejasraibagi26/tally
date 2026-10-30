import { useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme } from "nativewind";
import { PanResponder, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { formatCents } from "@tally/core/money";
import type { ForecastDay, ForecastEvent } from "@tally/core/forecast";
import { usePrivacy } from "@/lib/PrivacyContext";
import { chartSeries } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

const HEIGHT = 170;
const TOP = 14;
const BOTTOM = 22; // room for the date labels

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Mobile's copy of web's components/forecast/ForecastChart.tsx: the
 * projected balance as a line, the likely range of day-to-day spending as a
 * band behind it, the buffer as a dashed line and the first short day as a
 * dot. Same forms as web, shortened — MOBILE_DESIGN.md's rule is to keep the
 * form and drop detail, never to change the chart because it's narrow.
 *
 * Press and drag to read a day, as web's crosshair does: the readout above
 * names the date, the balance, and what lands that day (or the likely range
 * when nothing does). Idle, it reads the window's last day.
 */
export function ForecastChart({
  days,
  events = [],
  cushion,
  shortfallDate,
  onScrubbingChange,
}: {
  days: ForecastDay[];
  events?: ForecastEvent[];
  cushion: number;
  shortfallDate?: string | null;
  /** Lets the screen lock its ScrollView while a finger is on the chart. */
  onScrubbingChange?: (scrubbing: boolean) => void;
}) {
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

  // Events by the day they move the curve: anything in the grace window lands
  // on day 0, the same rule computeForecast applies.
  const eventsOn = useMemo(() => {
    const today = days[0]?.date ?? "";
    const by = new Map<string, ForecastEvent[]>();
    for (const e of events) {
      const key = e.date < today ? today : e.date;
      by.set(key, [...(by.get(key) ?? []), e]);
    }
    return by;
  }, [days, events]);

  // Same touch handling as PortfolioChart and GoalChart: the responder is
  // created once and reads the latest width and count through a ref.
  const [index, setIndex] = useState<number | null>(null);
  const live = useRef({ width, count: days.length, onScrubbingChange });
  useEffect(() => {
    live.current = { width, count: days.length, onScrubbingChange };
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
      live.current.onScrubbingChange?.(false);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        live.current.onScrubbingChange?.(true);
        pageX.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
        scrubAt(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (_evt, g) => scrubAt(g.moveX - pageX.current),
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  });

  const at = index != null ? Math.min(index, days.length - 1) : null;
  const shown = days[at ?? days.length - 1];
  const landing = shown ? (eventsOn.get(shown.date) ?? []) : [];
  // Always one line, so the chart doesn't jump as the finger crosses days.
  const detail = landing.length
    ? landing.map((e) => `${e.label} ${money(e.amount)}${e.affectsCash ? "" : " (on a card)"}`).join(" · ")
    : shown && shown.lo !== shown.balance
      ? `Likely ${money(shown.lo)} to ${money(shown.hi)}`
      : " ";

  return (
    <View>
      {shown && (
        <View className="mb-2">
          <View className="flex-row items-baseline justify-between">
            <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
              {dayLabel(shown.date)}
            </Text>
            <Text
              className="font-ui-semibold"
              style={{ fontSize: rf(15), fontVariant: ["tabular-nums"], color: shown.balance < 0 ? colors.negative : colors.text }}
            >
              {money(shown.balance)}
            </Text>
          </View>
          <Text className="font-ui text-text-3 mt-0.5" numberOfLines={1} style={{ fontSize: rf(11.5) }}>
            {detail}
          </Text>
        </View>
      )}
      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
        accessible
        accessibilityLabel={`Projected balance to ${shortDate(days.at(-1)?.date ?? "")}. Press and drag to read a day.`}
      >
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
            {at != null && (
              <>
                <Line x1={geo.X(at)} x2={geo.X(at)} y1={0} y2={HEIGHT - BOTTOM} stroke={colors["text-3"]} strokeWidth={1} strokeDasharray="2,3" />
                <Circle cx={geo.X(at)} cy={geo.Y(days[at]!.balance)} r={4} fill={series1} stroke={colors.surface} strokeWidth={2} />
              </>
            )}
            <SvgText x={0} y={HEIGHT - 6} fill={colors["text-3"]} fontSize={rf(10)} fontFamily="Figtree">
              {shortDate(days[0]!.date)}
            </SvgText>
            <SvgText x={width} y={HEIGHT - 6} fill={colors["text-3"]} fontSize={rf(10)} textAnchor="end" fontFamily="Figtree">
              {shortDate(days.at(-1)!.date)}
            </SvgText>
          </Svg>
        )}
      </View>
      {cushion > 0 && (
        <Text className="font-ui text-text-3 mt-1" style={{ fontSize: rf(11) }}>
          Dashed line is your {money(cushion)} buffer
        </Text>
      )}
    </View>
  );
}
