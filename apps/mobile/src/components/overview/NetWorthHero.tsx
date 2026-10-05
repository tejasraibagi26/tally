import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, PanResponder, Animated, AccessibilityInfo, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { formatCents } from "@tally/core/money";
import { NET_WORTH_RANGES, RANGE_CAPTION, netWorthDelta, sliceNetWorthRange, type NetWorthRange } from "@tally/core/overviewView";
import { SplitMoney } from "@/components/ui/SplitMoney";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePrivacy } from "@/lib/PrivacyContext";
import { todayISO } from "@/lib/today";
import type { NetWorthPoint } from "@/lib/queries/overview";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

// Net worth chart height -- taller than the old 56px strip now that it runs
// full-bleed, matching web's more immersive Overview chart.
const HERO_CHART_HEIGHT = 112;
const DEFAULT_RANGE: NetWorthRange = "1M";
/** One accessibility step moves the chart a week. */
const A11Y_STEP_DAYS = 7;
const A11Y_RESET_MS = 5000;

function dateLabel(asOfDate: string): string {
  return new Date(asOfDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * The Overview's headline: net worth in serif with the cents quieted, a delta
 * chip for the chosen range, the full-bleed trend chart you can scrub, and a
 * 1M/3M/6M/1Y range control. The range only slices the daily series the
 * screen already loaded (12 months), so changing it costs no request.
 */
export function NetWorthHero({
  netCents,
  points,
  loading,
  onScrubChange,
}: {
  netCents: number;
  points: NetWorthPoint[];
  loading: boolean;
  /** True for the duration of a finger on the chart -- the screen locks its ScrollView meanwhile. */
  onScrubChange: (scrubbing: boolean) => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const { hidden } = usePrivacy();
  const { width: windowWidth } = useWindowDimensions();
  const [range, setRange] = useState<NetWorthRange>(DEFAULT_RANGE);
  // The chart was hardcoded to 300 -- narrower than the available width on
  // most phones (leaving a gap on the right) and wider than it on the
  // smallest ones (clipping). Measured via onLayout on its wrapping View so
  // it always spans exactly the real width; the window width avoids a flash
  // of a fixed width before the first layout pass.
  const [chartWidth, setChartWidth] = useState(windowWidth);
  // Index into the visible points currently under a finger dragging across
  // the chart (or stepped to by a screen reader), or null when nothing is --
  // the hero figure and its subtitle read off this instead of the live total
  // while it's set, then snap back on release.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // Touch x-position local to the chart, in px -- drives the vertical
  // scrub-position indicator drawn over the chart. null when not touching.
  const [touchX, setTouchX] = useState<number | null>(null);
  // Persists across a single gesture's Grant→Move events; written once at
  // Grant and only read within that same still-in-progress gesture.
  const chartPageXRef = useRef(0);
  const a11yIndexRef = useRef<number | null>(null);
  const a11yResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    return () => {
      if (a11yResetRef.current) clearTimeout(a11yResetRef.current);
    };
  }, []);

  const today = todayISO();
  // A range with fewer than two snapshots can't draw a line, so fall back to
  // the whole series rather than an empty chart.
  const visible = useMemo(() => {
    const sliced = sliceNetWorthRange(points, range, today);
    return sliced.length >= 2 ? sliced : points;
  }, [points, range, today]);
  const chartData = useMemo(() => visible.map((p) => ({ value: p.net / 100 })), [visible]);
  const delta = useMemo(() => (loading ? undefined : netWorthDelta(points, netCents, range, today)), [loading, points, netCents, range, today]);

  function chooseRange(next: NetWorthRange) {
    if (next === range) return;
    setRange(next);
    if (!reduceMotion) {
      fade.setValue(0.35);
      Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }

  function endChartScrub() {
    onScrubChange(false);
    setHoverIndex(null);
    setTouchX(null);
  }

  function updateChartHoverFromLocalX(localX: number, width: number, pointCount: number) {
    const clamped = Math.max(0, Math.min(width, localX));
    setTouchX(clamped);
    if (pointCount < 2 || width <= 0) return;
    const idx = Math.round((clamped / width) * (pointCount - 1));
    setHoverIndex(Math.max(0, Math.min(pointCount - 1, idx)));
  }

  // Two library-dependent approaches (gifted-charts' pointerConfig touch
  // callbacks, then a wrapping View's raw onTouchStart/End/Cancel) both
  // turned out not to fire reliably on release. This owns the gesture
  // directly instead: a PanResponder computes the touched index itself, and
  // onPanResponderRelease/Terminate -- core React Native touch-lifecycle
  // callbacks -- are what reset it back to the live figure. Recreated only
  // when the chart's own width or point count changes (not on every
  // hoverIndex/touchX update mid-drag), so a gesture in progress keeps the
  // same handler instance throughout.
  const chartPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          onScrubChange(true);
          chartPageXRef.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
          updateChartHoverFromLocalX(evt.nativeEvent.locationX, chartWidth, chartData.length);
        },
        onPanResponderMove: (_evt, gestureState) => {
          updateChartHoverFromLocalX(gestureState.moveX - chartPageXRef.current, chartWidth, chartData.length);
        },
        onPanResponderRelease: endChartScrub,
        onPanResponderTerminate: endChartScrub,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chartWidth, chartData.length],
  );

  // Screen readers can't drag, so the chart is an adjustable control:
  // swipe up/down steps a week, announcing the day and value, then the
  // figure returns to the live total a few seconds later.
  function stepChart(direction: 1 | -1) {
    if (visible.length < 2) return;
    const from = a11yIndexRef.current ?? visible.length - 1;
    const idx = Math.max(0, Math.min(visible.length - 1, from + direction * A11Y_STEP_DAYS));
    a11yIndexRef.current = idx;
    setHoverIndex(idx);
    const point = visible[idx]!;
    AccessibilityInfo.announceForAccessibility(`${dateLabel(point.asOfDate)}, ${hidden ? "amount hidden" : formatCents(point.net)}`);
    if (a11yResetRef.current) clearTimeout(a11yResetRef.current);
    a11yResetRef.current = setTimeout(() => {
      a11yIndexRef.current = null;
      setHoverIndex(null);
    }, A11Y_RESET_MS);
  }

  const hoveredPoint = hoverIndex != null ? (visible[hoverIndex] ?? null) : null;
  const heroCents = hoveredPoint ? hoveredPoint.net : netCents;

  // gifted-charts' LineChart defaults its y-axis to start at 0 unless told
  // otherwise, so a real net-worth trend (a large baseline with small
  // day-to-day variation, e.g. $420k-$425k) renders as a nearly flat line
  // pinned near the top -- web's recharts chart auto-scales to the data's
  // own min/max instead. yAxisOffset reproduces that: start the visible range
  // just under the data's actual minimum. maxValue gives the top a small
  // headroom so `curved`'s bezier overshoot (and the area fill under it)
  // isn't clipped flat by the SVG canvas edge. gifted-charts subtracts
  // yAxisOffset from every value *before* plotting, so maxValue is expressed
  // on that offset-adjusted scale, not the raw net-worth scale.
  const { chartYAxisOffset, chartMaxValue } = useMemo(() => {
    if (chartData.length < 2) return { chartYAxisOffset: 0, chartMaxValue: undefined };
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || Math.abs(min) * 0.02 || 1;
    const yAxisOffset = min - pad;
    return { chartYAxisOffset: yAxisOffset, chartMaxValue: max - yAxisOffset + pad * 0.25 };
  }, [chartData]);

  const up = delta?.direction === "up";
  const deltaText = delta ? `${up ? "▲" : "▼"} ${hidden ? "" : `${up ? "+" : "−"}${formatCents(delta.cents)} · `}${delta.pct}%` : null;
  const spoken = loading
    ? "Net worth"
    : `Net worth ${hidden ? "hidden" : formatCents(netCents)}${delta ? `, ${up ? "up" : "down"} ${hidden ? "" : `${formatCents(delta.cents)}, `}${delta.pct} percent, ${RANGE_CAPTION[range].toLowerCase()}` : ""}`;

  return (
    <View className="gap-3">
      <Text className="font-ui-medium tracking-wide text-text-2" style={{ textTransform: "uppercase", fontSize: rf(11) }}>
        Net worth
      </Text>
      {loading ? (
        <View className="gap-2">
          <Skeleton style={{ width: 230, height: 50 }} />
          <Skeleton style={{ width: 150, height: 26, borderRadius: 999 }} />
        </View>
      ) : (
        <View className="gap-2.5" accessible accessibilityLabel={spoken}>
          <SplitMoney cents={heroCents} size={56} centsSize={28} lineHeight={58} />
          {hoveredPoint ? (
            <View className="h-[26px] justify-center">
              <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>{dateLabel(hoveredPoint.asOfDate)}</Text>
            </View>
          ) : (
            delta && deltaText && (
              <View className="flex-row items-center gap-2.5">
                <View className="h-[26px] justify-center rounded-full px-2.5" style={{ backgroundColor: up ? colors["positive-subtle"] : colors["negative-subtle"] }}>
                  <Text className="font-ui-medium" style={{ fontSize: rf(12.5), color: up ? colors.positive : colors.negative, fontVariant: ["tabular-nums"] }}>{deltaText}</Text>
                </View>
                <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>{RANGE_CAPTION[range]}</Text>
              </View>
            )
          )}
        </View>
      )}
      {points.length > 1 && (
        <>
          <Animated.View
            onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
            // Full-bleed, like web's Overview chart: the negative margin
            // cancels the screen's px-5 so the area runs edge to edge.
            // Scrubbing reads locationX within this view, and chartWidth is
            // measured from it.
            style={{ height: HERO_CHART_HEIGHT, marginHorizontal: -20, opacity: fade }}
            {...chartPanResponder.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Net worth chart"
            accessibilityHint="Swipe up or down to step through the past weeks"
            accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
            onAccessibilityAction={(e) => stepChart(e.nativeEvent.actionName === "increment" ? 1 : -1)}
          >
            <LineChart
              data={chartData}
              height={HERO_CHART_HEIGHT}
              width={chartWidth}
              adjustToWidth
              // Even with hideYAxisText, gifted-charts reserves a hidden 10px
              // y-axis label column by default and adds it on top of `width`;
              // forcing it to 0 makes the plotted width match `width` exactly.
              yAxisLabelWidth={0}
              initialSpacing={0}
              endSpacing={0}
              thickness={2.5}
              color={colors.brand}
              yAxisOffset={chartYAxisOffset}
              maxValue={chartMaxValue}
              areaChart
              startFillColor={colors.brand}
              endFillColor={colors.brand}
              startOpacity={0.28}
              endOpacity={0}
              hideDataPoints
              hideYAxisText
              hideAxesAndRules
              disableScroll
              curved
            />
            {/* Slide-to-scrub position indicator -- a plain vertical guide
                rather than a dot pinned to the curve, since that would mean
                re-deriving gifted-charts' own internal y-scaling. */}
            {touchX != null && (
              <View
                pointerEvents="none"
                style={{ position: "absolute", left: touchX - 0.75, top: 0, width: 1.5, height: HERO_CHART_HEIGHT, backgroundColor: colors.brand, opacity: 0.55 }}
              />
            )}
          </Animated.View>
          <View className="flex-row gap-1" accessibilityRole="tablist">
            {NET_WORTH_RANGES.map((r) => {
              const on = r === range;
              return (
                <Pressable
                  key={r}
                  onPress={() => chooseRange(r)}
                  hitSlop={{ top: 8, bottom: 8 }}
                  className="h-7 px-3 rounded-full items-center justify-center"
                  style={on ? { backgroundColor: colors["brand-subtle"] } : undefined}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={RANGE_CAPTION[r]}
                >
                  <Text className="font-ui-medium" style={{ fontSize: rf(12), color: on ? colors.brand : colors["text-3"] }}>{r}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
