import { useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, useWindowDimensions, PanResponder } from "react-native";
import { useRouter } from "expo-router";
import { Ellipsis, Eye, EyeOff } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LineChart } from "react-native-gifted-charts";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { MeterBar } from "@/components/ui/MeterBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useAccounts } from "@/lib/queries/accounts";
import { TabHeader, SyncFreshness, hasSynced } from "@/components/ui/TabHeader";
import { useOverview, useNetWorthTrend } from "@/lib/queries/overview";
import { useTransactions } from "@/lib/queries/transactions";
import { useCashFlowTrend } from "@/lib/queries/cashflow";
import { useLiabilities } from "@/lib/queries/liabilities";
import { useHoldings } from "@/lib/queries/investments";
import { useCategoryBreakdown } from "@/lib/queries/spendBreakdown";
import { CategorySpendBar } from "@/components/charts/CategorySpendBar";
import { AttentionStack } from "@/components/overview/AttentionStack";
import { MonthCard } from "@/components/overview/MonthCard";
import { StatPair } from "@/components/overview/StatPair";
import { UpcomingList } from "@/components/overview/UpcomingList";
import { RecentList } from "@/components/overview/RecentList";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useTabBarBottomClearance } from "@/lib/useTabBarBottomClearance";
import { rankBudgets } from "@tally/core/overviewView";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

// MOBILE_DESIGN.md §5.2 -- hero net worth (unboxed, direct on canvas), a
// KPI stat-tile strip (spend/income/investments/utilization), a single-line
// connections summary, "Budget this month" (top 3), "Upcoming", and
// "Recent activity."
// Hero net worth chart height -- taller than the old 56px strip now that it
// runs full-bleed, matching web's more immersive Overview chart.
const HERO_CHART_HEIGHT = 96;

export default function OverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarBottomClearance();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const rf = useRF();
  const accounts = useAccounts();
  const overview = useOverview();
  const trend = useNetWorthTrend();
  const recent = useTransactions();
  const cashFlow = useCashFlowTrend(2);
  const liabilities = useLiabilities();
  const holdings = useHoldings();
  const breakdown = useCategoryBreakdown();
  const { hidden, toggle: togglePrivacy } = usePrivacy();
  const { width: windowWidth } = useWindowDimensions();
  // The chart was hardcoded to 300 -- narrower than the available width on
  // most phones (leaving a gap on the right) and wider than it on the
  // smallest ones (clipping). Measured via onLayout on its wrapping View so
  // it always spans exactly the hero section's real width; the window-width
  // fallback (minus the screen's 40px of horizontal px-5 padding) avoids a
  // flash of the old fixed width before the first layout pass.
  const [chartWidth, setChartWidth] = useState(windowWidth);
  // Index into trend.data.points/chartData currently under a finger dragging
  // across the net worth chart, or null when nothing's being touched -- the
  // hero figure and its subtitle below read off this instead of the live
  // totals while it's set, then snap back to normal on release.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // True for the duration of a finger touching the chart -- locks the outer
  // ScrollView (its scrollEnabled prop below) for the same duration.
  const [isScrubbingChart, setIsScrubbingChart] = useState(false);
  // Touch x-position local to the chart, in px -- drives the vertical
  // scrub-position indicator drawn over the chart. null when not touching.
  const [touchX, setTouchX] = useState<number | null>(null);
  // Persists across a single gesture's Grant→Move events (see
  // chartPanResponder below); doesn't need "fresh each render" treatment
  // the way chartWidth/chartData do, since it's written once at Grant and
  // only ever read within that same still-in-progress gesture.
  const chartPageXRef = useRef(0);

  function endChartScrub() {
    setIsScrubbingChart(false);
    setHoverIndex(null);
    setTouchX(null);
  }

  const netCents = accounts.data?.totals.net ?? 0;

  // /api/analytics/networth returns one point per day (nightly net-worth
  // snapshots), not one per month -- matches web's NetWorthChart.tsx, which
  // plots every point in the 12-month window unsliced. An earlier version
  // here sliced to the last 12 *points* assuming monthly granularity, which
  // actually plotted only the most recent ~12 days.
  const chartData = useMemo(() => (trend.data?.points ?? []).map((p) => ({ value: p.net / 100 })), [trend.data]);

  function updateChartHoverFromLocalX(localX: number, width: number, pointCount: number) {
    const clamped = Math.max(0, Math.min(width, localX));
    setTouchX(clamped);
    if (pointCount < 2 || width <= 0) return;
    const idx = Math.round((clamped / width) * (pointCount - 1));
    setHoverIndex(Math.max(0, Math.min(pointCount - 1, idx)));
  }

  // Two library-dependent approaches (gifted-charts' pointerConfig touch
  // callbacks, then a wrapping View's raw onTouchStart/End/Cancel) both
  // turned out not to fire reliably on release -- gifted-charts wires its
  // pointerConfig touch hooks on only one of two internal render paths, and
  // apparently the outer View's raw touch props aren't guaranteed either
  // once a descendant has claimed the responder. This owns the gesture
  // directly instead: a PanResponder computes the touched index itself (no
  // dependency on gifted-charts' pointer system at all), and
  // onPanResponderRelease/Terminate -- core React Native touch-lifecycle
  // callbacks, not a third-party library's potentially-partial wiring --
  // are what reset it back to the live figure.
  //
  // Recreated only when the chart's own width or point count changes (not
  // on every hoverIndex/touchX update mid-drag), so a gesture in progress
  // keeps the same handler instance throughout -- but this still never
  // closes over a stale chartWidth/chartData the way a mount-once
  // useRef(PanResponder.create(...)) would have.
  const chartPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          setIsScrubbingChart(true);
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

  // 1:1 with chartData -- both come from the same trend.data.points map
  // above, unsliced, so a chart pointerIndex indexes this directly.
  const hoveredPoint = hoverIndex != null ? (trend.data?.points[hoverIndex] ?? null) : null;
  const heroCents = hoveredPoint ? hoveredPoint.net : netCents;
  const hoveredDateLabel = hoveredPoint
    ? new Date(hoveredPoint.asOfDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;

  // gifted-charts' LineChart defaults its y-axis to start at 0 unless told
  // otherwise, so a real net-worth trend (a large baseline with small
  // day-to-day variation, e.g. $420k-$425k) renders as a nearly flat line
  // pinned near the top -- web's recharts chart auto-scales to the data's
  // own min/max (domain={["auto","auto"]}) instead. yAxisOffset reproduces
  // that: start the visible range just under the data's actual minimum.
  // maxValue gives the top the same kind of headroom: without it, the highest
  // data point sits exactly at the chart's top edge, and `curved`'s cubic
  // bezier segments routinely overshoot past their endpoints -- with zero
  // headroom above, that overshoot (and the areaChart fill under it) was
  // getting clipped flat by the SVG canvas boundary instead of rendering
  // the little bulge a curved line is supposed to have. That overshoot is
  // only ever a few px, though, so the top gets a much smaller fraction of
  // the same pad than the bottom does -- just enough to clear the bezier.
  //
  // gifted-charts subtracts yAxisOffset from every value *before* plotting
  // (Y = (value - yAxisOffset) / maxValue * height), so maxValue has to be
  // expressed on that same offset-adjusted scale -- NOT the raw net-worth
  // scale. Passing the raw `max` here divides a tiny adjusted numerator
  // (a few thousand dollars of actual variance) by the full ~$400k+ raw
  // balance, which pins every point within a percent of the bottom of the
  // chart -- the line renders as almost a dead-straight line pinned low,
  // not the flattened-but-still-curved line a too-generous pad would give.
  const { chartYAxisOffset, chartMaxValue } = useMemo(() => {
    if (chartData.length < 2) return { chartYAxisOffset: 0, chartMaxValue: undefined };
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || Math.abs(min) * 0.02 || 1;
    const yAxisOffset = min - pad;
    return { chartYAxisOffset: yAxisOffset, chartMaxValue: max - yAxisOffset + pad * 0.25 };
  }, [chartData]);

  // Matches web's Overview page: walk the trend backwards for the most
  // recent snapshot at/before a month ago, then compare against today's
  // live total (not the trend's own last point, which can lag behind an
  // in-progress balance refresh) -- no chip at all, rather than a
  // misleading "0%", when there's no real history to compare against yet.
  const netWorthDelta = useMemo(() => {
    const points = trend.data?.points ?? [];
    if (points.length < 2 || !accounts.data) return undefined;
    const now = new Date();
    const monthAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, now.getUTCDate())).toISOString().slice(0, 10);
    const prior = [...points].reverse().find((p) => p.asOfDate <= monthAgo)?.net;
    if (prior == null || prior === 0) return undefined;
    const change = (netCents - prior) / Math.abs(prior);
    return { direction: change >= 0 ? ("up" as const) : ("down" as const), pct: Math.round(Math.abs(change) * 100) };
  }, [trend.data, accounts.data, netCents]);

  const recentItems = recent.data?.pages[0]?.items.slice(0, 5) ?? [];
  const topBudgets = rankBudgets(overview.data?.budgets.categories ?? [], 3);

  const months = cashFlow.data?.months ?? [];
  const currentMonth = months[months.length - 1];
  const priorMonth = months.length > 1 ? months[months.length - 2] : undefined;
  const utilization = liabilities.data?.utilization.utilization ?? null;

  const totalBudgeted = overview.data?.budgets.totalBudgeted ?? 0;
  const investmentsCents = holdings.data && holdings.data.holdings.length > 0 ? holdings.data.value : null;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const refreshing = accounts.isFetching || overview.isFetching || trend.isFetching;
  function onRefresh() {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["networth-trend"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["cashflow"] });
    queryClient.invalidateQueries({ queryKey: ["liabilities"] });
    queryClient.invalidateQueries({ queryKey: ["investments"] });
    queryClient.invalidateQueries({ queryKey: ["category-breakdown"] });
  }

  return (
    <View className="flex-1 bg-canvas">
      <ScreenGlow />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 + tabBarClearance }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        // A finger landing on the chart still has to win the touch responder
        // race against this ScrollView's own pan gesture -- without this,
        // that race is what made scrubbing feel unreliable (a vertical
        // wobble mid-drag could hand the touch to the scroll view instead
        // of the chart). scrollEnabled is flipped off at onPanResponderGrant
        // (chartPanResponder below) and back on at release/terminate,
        // removing the ScrollView from contention entirely for the
        // duration of a scrub instead of relying on gesture arbitration.
        scrollEnabled={!isScrubbingChart}
      >
        <View className="px-5 pb-1">
          <TabHeader
            title="Overview"
            meta={[
              new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
              hasSynced(accounts.data?.institutions.map((i) => i.lastSyncedAt) ?? []) && <SyncFreshness key="sync" syncedAt={accounts.data?.institutions.map((i) => i.lastSyncedAt) ?? []} />,
            ]}
            actions={
              <View className="flex-row items-center gap-4">
          <Pressable onPress={togglePrivacy} hitSlop={12} accessibilityRole="switch" accessibilityLabel="Hide sensitive amounts" accessibilityState={{ checked: hidden }}>
            {hidden ? <EyeOff size={20} color={colors["text-2"]} strokeWidth={1.75} /> : <Eye size={20} color={colors["text-2"]} strokeWidth={1.75} />}
          </Pressable>
          <Pressable onPress={() => router.push("/more")} hitSlop={12}>
            <Ellipsis size={22} color={colors["text-2"]} strokeWidth={1.75} />
          </Pressable>
              </View>
            }
          />
        </View>

      <View className="gap-7 px-5 pt-3">
        {/* Hero net worth -- unboxed, per MOBILE_DESIGN.md */}
        <View className="gap-3">
          <Text className="font-ui-medium tracking-wide text-text-2" style={{ textTransform: "uppercase", fontSize: rf(11) }}>
            Net worth
          </Text>
          {accounts.isLoading ? (
            <View className="gap-2">
              <Skeleton style={{ width: 220, height: 44 }} />
              <Skeleton style={{ width: 130, height: 15 }} />
            </View>
          ) : (
            <View className="gap-1">
              <MoneyText cents={heroCents} className="font-display text-text" style={{ lineHeight: rf(62), fontSize: rf(60) }} />
              {hoveredDateLabel ? (
                <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(13) }}>{hoveredDateLabel}</Text>
              ) : (
                netWorthDelta && (
                  <Text className="font-ui-medium" style={{ color: netWorthDelta.direction === "up" ? colors.positive : colors.negative, fontSize: rf(13) }}>
                    {netWorthDelta.direction === "up" ? "▲" : "▼"} {netWorthDelta.pct}% vs last month
                  </Text>
                )
              )}
            </View>
          )}
          {chartData.length > 1 && (
            <View
              onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
              // Full-bleed, like web's Overview chart: the negative margin
              // cancels the screen's px-5 so the area runs edge to edge.
              // Scrubbing is unaffected -- it reads locationX within this
              // view, and chartWidth is measured from it.
              style={{ height: HERO_CHART_HEIGHT, marginHorizontal: -20 }}
              {...chartPanResponder.panHandlers}
            >
              <LineChart
                data={chartData}
                height={HERO_CHART_HEIGHT}
                width={chartWidth}
                adjustToWidth
                // Even with hideYAxisText, gifted-charts reserves a hidden
                // 10px y-axis label column by default (yAxisEmptyLabelWidth)
                // and adds it on top of `width` -- the line's right end
                // overflowed past the measured container by exactly that
                // much. Forcing it to 0 removes the phantom reservation so
                // the plotted width matches `width` exactly.
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
                  rather than a dot pinned exactly to the curve, since that
                  would mean re-deriving gifted-charts' own internal y-scaling
                  (yAxisOffset/maxValue) rather than something owned here.
                  Touch handling for the whole gesture (including this x
                  position) is chartPanResponder above; the hero figure/date
                  above read off the same hoverIndex it sets. */}
              {touchX != null && (
                <View
                  pointerEvents="none"
                  style={{ position: "absolute", left: touchX - 0.75, top: 0, width: 1.5, height: HERO_CHART_HEIGHT, backgroundColor: colors.brand, opacity: 0.55 }}
                />
              )}
            </View>
          )}
        </View>

        {/* Banks that need a tap and the review backlog -- renders nothing when
            all is well; sync freshness already sits in the header meta line. */}
        <AttentionStack institutions={accounts.data?.institutions ?? []} unreviewed={overview.data?.unreviewed ?? 0} />

        {/* This month: spend against budget, income, saved -- with Investments and Credit used tucked just beneath */}
        <View className="gap-3">
          {currentMonth && (
            <MonthCard
              spend={currentMonth.spend}
              income={currentMonth.income}
              priorIncome={priorMonth?.income}
              totalBudgeted={totalBudgeted}
              daysElapsed={now.getDate()}
              daysInMonth={daysInMonth}
            />
          )}
          <StatPair investmentsCents={investmentsCents} utilization={utilization} />
        </View>

        {/* Budget this month */}
        {topBudgets.length > 0 && (
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Budget this month</Text>
              <Pressable onPress={() => router.push("/(tabs)/budgets")}>
                <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>View all</Text>
              </Pressable>
            </View>
            <Card className="p-5 gap-5">
              {topBudgets.map((b) => (
                <MeterBar key={b.categoryId} label={b.categoryName} colorSlot={b.colorSlot ?? b.categoryColorSlot} spentCents={b.spend} budgetCents={b.amount + b.rolloverFromPrior} mask={false} />
              ))}
            </Card>
          </View>
        )}

        {/* Upcoming */}
        <UpcomingList bills={overview.data?.upcomingBills ?? []} />

        {/* Recent activity */}
        <RecentList items={recentItems} />

        {/* Where it went -- analysis rather than action, so it closes the screen */}
        {(breakdown.data?.rows.length ?? 0) > 0 && (
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Where it went</Text>
              <Pressable onPress={() => router.push("/(tabs)/transactions")} hitSlop={8}>
                <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>View all</Text>
              </Pressable>
            </View>
            <Card className="p-5">
              <CategorySpendBar rows={breakdown.data!.rows} />
            </Card>
          </View>
        )}
      </View>
      </ScrollView>
    </View>
  );
}
