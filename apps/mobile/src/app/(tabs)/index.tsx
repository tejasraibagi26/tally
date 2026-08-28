import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { CircleCheck, ChevronRight, Ellipsis } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LineChart } from "react-native-gifted-charts";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { MeterBar } from "@/components/ui/MeterBar";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useAccounts } from "@/lib/queries/accounts";
import { useOverview, useNetWorthTrend } from "@/lib/queries/overview";
import { useTransactions } from "@/lib/queries/transactions";
import { useCashFlowTrend } from "@/lib/queries/cashflow";
import { useLiabilities } from "@/lib/queries/liabilities";
import { amountColor } from "@/lib/amountColor";
import { useThemeColors } from "@/theme/useThemeColors";
import { hairline } from "@/theme/colors";

// MOBILE_DESIGN.md §5.2 -- hero net worth (unboxed, direct on canvas), a
// KPI stat-tile strip (spend/income/cashflow/utilization), a single-line
// connections summary, "Budget this month" (top 3), "Upcoming", and
// "Recent activity."
export default function OverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const colors = useThemeColors();
  const accounts = useAccounts();
  const overview = useOverview();
  const trend = useNetWorthTrend();
  const recent = useTransactions();
  const cashFlow = useCashFlowTrend(2);
  const liabilities = useLiabilities();

  const netCents = accounts.data?.totals.net ?? 0;
  const allSynced = accounts.data ? accounts.data.institutions.every((i) => i.badge === "good") : true;
  const brokenCount = accounts.data ? accounts.data.institutions.filter((i) => i.badge === "critical").length : 0;

  // /api/analytics/networth returns one point per day (nightly net-worth
  // snapshots), not one per month -- matches web's NetWorthChart.tsx, which
  // plots every point in the 12-month window unsliced. An earlier version
  // here sliced to the last 12 *points* assuming monthly granularity, which
  // actually plotted only the most recent ~12 days.
  const chartData = useMemo(() => (trend.data?.points ?? []).map((p) => ({ value: p.net / 100 })), [trend.data]);

  // gifted-charts' LineChart defaults its y-axis to start at 0 unless told
  // otherwise, so a real net-worth trend (a large baseline with small
  // day-to-day variation, e.g. $420k-$425k) renders as a nearly flat line
  // pinned near the top -- web's recharts chart auto-scales to the data's
  // own min/max (domain={["auto","auto"]}) instead. yAxisOffset reproduces
  // that: start the visible range just under the data's actual minimum.
  const chartYAxisOffset = useMemo(() => {
    if (chartData.length < 2) return 0;
    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.1 || Math.abs(min) * 0.02 || 1;
    return min - pad;
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
  const topBudgets = (overview.data?.budgets.categories ?? []).slice(0, 3);

  const months = cashFlow.data?.months ?? [];
  const currentMonth = months[months.length - 1];
  const priorMonth = months.length > 1 ? months[months.length - 2] : undefined;
  const utilizationPct = liabilities.data?.utilization.utilization != null ? Math.round(liabilities.data.utilization.utilization * 100) : null;

  // Cash flow deliberately isn't brand-subtle: it's nearly the same hex as
  // positive-subtle (Income) in both themes (both a muted evergreen), so the
  // two tiles read as the same color -- warning-subtle (amber) is the 4th
  // genuinely distinct tint, alongside negative (spend) and info (utilization).
  // The actual class per tile.key is chosen where it's rendered (a literal
  // className branch, not a string built here) -- see that comment for why.
  const kpiTiles = currentMonth
    ? [
        {
          key: "spend",
          label: "Spent this month",
          cents: currentMonth.spend,
          delta: priorMonth ? deltaLabel(currentMonth.spend, priorMonth.spend) : undefined,
        },
        {
          key: "income",
          label: "Income",
          cents: currentMonth.income,
          delta: priorMonth ? deltaLabel(currentMonth.income, priorMonth.income) : undefined,
        },
        {
          key: "cashflow",
          label: "Cash flow",
          cents: currentMonth.cashFlow,
          delta: priorMonth ? deltaLabel(currentMonth.cashFlow, priorMonth.cashFlow) : undefined,
        },
      ]
    : [];

  const refreshing = accounts.isFetching || overview.isFetching || trend.isFetching;
  function onRefresh() {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["networth-trend"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["cashflow"] });
    queryClient.invalidateQueries({ queryKey: ["liabilities"] });
  }

  return (
    <View className="flex-1 bg-canvas">
      <ScreenGlow />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View className="flex-row items-center justify-between px-5 pb-1">
        <Text className="font-ui-semibold text-[24px] text-text" style={{ letterSpacing: -0.3 }}>
          Overview
        </Text>
        <Pressable onPress={() => router.push("/more")} hitSlop={12}>
          <Ellipsis size={22} color={colors["text-2"]} strokeWidth={1.75} />
        </Pressable>
      </View>

      <View className="gap-7 px-5 pt-3">
        {/* Hero net worth -- unboxed, per MOBILE_DESIGN.md */}
        <View className="gap-3">
          <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
            Net worth
          </Text>
          {accounts.isLoading ? (
            <ActivityIndicator className="self-start" />
          ) : (
            <View className="gap-1">
              <MoneyText cents={netCents} className="font-display text-[50px] text-text" style={{ lineHeight: 52 }} />
              {netWorthDelta && (
                <Text className="font-ui-medium text-[13px]" style={{ color: netWorthDelta.direction === "up" ? colors.positive : colors.negative }}>
                  {netWorthDelta.direction === "up" ? "▲" : "▼"} {netWorthDelta.pct}% vs last month
                </Text>
              )}
            </View>
          )}
          {chartData.length > 1 && (
            <LineChart
              data={chartData}
              height={56}
              width={300}
              thickness={2.5}
              color={colors.brand}
              yAxisOffset={chartYAxisOffset}
              areaChart
              startFillColor={colors["brand-subtle"]}
              endFillColor={colors["brand-subtle"]}
              startOpacity={0.9}
              endOpacity={0.3}
              hideDataPoints
              hideYAxisText
              hideAxesAndRules
              disableScroll
              curved
            />
          )}
        </View>

        {/* Connections status */}
        <Pressable onPress={() => router.push("/(tabs)/accounts")}>
          <View className="rounded-panel flex-row items-center justify-between px-[18px] py-4 bg-brand-subtle">
            <View className="flex-row items-center gap-2.5">
              <CircleCheck size={17} color={colors.brand} strokeWidth={2} />
              <Text className="font-ui-medium text-[14.5px] text-brand">
                {brokenCount > 0
                  ? `${brokenCount} connection${brokenCount === 1 ? "" : "s"} needs attention`
                  : allSynced
                    ? "All accounts synced"
                    : "Sync in progress"}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.brand} strokeWidth={1.75} />
          </View>
        </Pressable>

        {/* KPI row -- a wrapping 2-column grid rather than a fixed-width
            horizontal scroll: at 140px-wide tiles, a horizontal ScrollView
            clips the last tile's text right at the screen edge on
            narrower/denser phones (nothing left to scroll to reveal the
            rest), which read as broken rather than "swipe for more." */}
        {(kpiTiles.length > 0 || utilizationPct !== null) && (
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {kpiTiles.map((tile) => (
              <View
                key={tile.key}
                // Literal per-branch classNames, not a template-literal
                // interpolation of a data-array string -- NativeWind only
                // generates CSS for utility classes it can statically see
                // inside a className expression. bg-warning-subtle was only
                // ever referenced via ${tile.bgClass} (unresolvable) and had
                // no other literal usage anywhere in the app, so it silently
                // produced no style at all (transparent tile, no error).
                className={
                  tile.key === "spend"
                    ? "rounded-panel px-4 py-4 gap-1.5 bg-negative-subtle"
                    : tile.key === "income"
                      ? "rounded-panel px-4 py-4 gap-1.5 bg-positive-subtle"
                      : "rounded-panel px-4 py-4 gap-1.5 bg-warning-subtle"
                }
                style={{ width: "48%" }}
              >
                <Text className="font-ui-medium text-[11.5px] text-text-2">{tile.label}</Text>
                <MoneyText cents={tile.cents} signed={tile.key === "cashflow"} className="font-ui-semibold text-[19px] text-text" numberOfLines={1} adjustsFontSizeToFit />
                {tile.delta && (
                  <Text className="font-ui text-[11.5px] text-text-3" numberOfLines={1}>{tile.delta}</Text>
                )}
              </View>
            ))}
            {utilizationPct !== null && (
              <View className="rounded-panel px-4 py-4 gap-1.5 bg-info-subtle" style={{ width: "48%" }}>
                <Text className="font-ui-medium text-[11.5px] text-text-2">Credit utilization</Text>
                <Text className="font-ui-semibold text-[19px] text-text">{utilizationPct}%</Text>
                <Text className="font-ui text-[11.5px] text-text-3">of total limit</Text>
              </View>
            )}
          </View>
        )}

        {/* Budget this month */}
        {topBudgets.length > 0 && (
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-ui-semibold text-[18px] text-text">Budget this month</Text>
              <Pressable onPress={() => router.push("/(tabs)/budgets")}>
                <Text className="font-ui-semibold text-[13.5px] text-brand">View all</Text>
              </Pressable>
            </View>
            <Card className="p-5 gap-5">
              {topBudgets.map((b) => (
                <MeterBar key={b.categoryId} label={b.categoryName} colorSlot={b.categoryColorSlot} spentCents={b.spend} budgetCents={b.amount + b.rolloverFromPrior} />
              ))}
            </Card>
          </View>
        )}

        {/* Upcoming */}
        {overview.data && overview.data.upcomingBills.length > 0 && (
          <View className="gap-4">
            <Text className="font-ui-semibold text-[18px] text-text">Upcoming</Text>
            <Card className="px-5">
              {overview.data.upcomingBills.slice(0, 3).map((bill, i, arr) => (
                <View
                  key={`${bill.label}-${bill.dueDate}`}
                  className="flex-row items-center justify-between py-4"
                  style={i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
                >
                  <Text className="font-ui text-[14.5px] text-text">{bill.label}</Text>
                  <MoneyText cents={bill.amount} className="text-[14.5px] text-text" />
                </View>
              ))}
            </Card>
          </View>
        )}

        {/* Recent activity */}
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="font-ui-semibold text-[18px] text-text">Recent activity</Text>
            <Pressable onPress={() => router.push("/(tabs)/transactions")}>
              <Text className="font-ui-semibold text-[13.5px] text-brand">View all</Text>
            </Pressable>
          </View>
          <Card className="px-5">
            {recentItems.length === 0 ? (
              <Text className="font-ui text-[14px] text-text-3 py-4">Nothing here yet.</Text>
            ) : (
              recentItems.map((t, i, arr) => (
                <View
                  key={t.id}
                  className="flex-row items-center justify-between py-4"
                  style={i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
                >
                  <View className="gap-0.5 flex-1 pr-3">
                    <Text className="font-ui-semibold text-[15px] text-text" numberOfLines={1}>
                      {t.merchantName ?? t.name}
                    </Text>
                  </View>
                  <MoneyText cents={t.amount} signed className="text-[15px] font-ui-medium" style={{ color: amountColor(t.amount, colors) }} />
                </View>
              ))
            )}
          </Card>
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

function deltaLabel(current: number, prior: number): string | undefined {
  if (prior === 0) return undefined;
  const pct = Math.round((Math.abs(current - prior) / Math.abs(prior)) * 100);
  return `${current >= prior ? "+" : "-"}${pct}% vs last month`;
}
