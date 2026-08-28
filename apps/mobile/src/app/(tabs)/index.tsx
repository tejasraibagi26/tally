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
import { useAccounts } from "@/lib/queries/accounts";
import { useOverview, useNetWorthTrend } from "@/lib/queries/overview";
import { useTransactions } from "@/lib/queries/transactions";
import { amountColor } from "@/lib/amountColor";

// MOBILE_DESIGN.md §5.2 -- hero net worth (unboxed, direct on canvas), a
// single-line connections summary, "Budget this month" (top 3), "Upcoming",
// and "Recent activity." The KPI stat-tile strip from the full spec is
// deferred -- it needs a spend/income/cashflow aggregate endpoint that
// doesn't exist yet; ship with what's already wired end to end.
export default function OverviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const overview = useOverview();
  const trend = useNetWorthTrend();
  const recent = useTransactions();

  const netCents = accounts.data?.totals.net ?? 0;
  const allSynced = accounts.data ? accounts.data.institutions.every((i) => i.badge === "good") : true;
  const brokenCount = accounts.data ? accounts.data.institutions.filter((i) => i.badge === "critical").length : 0;

  const chartData = useMemo(
    () => (trend.data?.points ?? []).slice(-12).map((p) => ({ value: p.net / 100 })),
    [trend.data],
  );

  const recentItems = recent.data?.pages[0]?.items.slice(0, 5) ?? [];
  const topBudgets = (overview.data?.budgets.categories ?? []).slice(0, 3);

  const refreshing = accounts.isFetching || overview.isFetching || trend.isFetching;
  function onRefresh() {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["overview"] });
    queryClient.invalidateQueries({ queryKey: ["networth-trend"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#14513F" />}
    >
      <View className="flex-row items-center justify-between px-5 pb-1">
        <Text className="font-ui-semibold text-[24px] text-text" style={{ letterSpacing: -0.3 }}>
          Overview
        </Text>
        <Pressable onPress={() => router.push("/more")} hitSlop={12}>
          <Ellipsis size={22} color="#524F47" strokeWidth={1.75} />
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
            <MoneyText cents={netCents} className="font-display text-[50px] text-text" style={{ lineHeight: 52 }} />
          )}
          {chartData.length > 1 && (
            <LineChart
              data={chartData}
              height={56}
              width={300}
              thickness={2.5}
              color="#14513F"
              areaChart
              startFillColor="#E6EFEA"
              endFillColor="#E6EFEA"
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
          <View className="rounded-panel flex-row items-center justify-between px-[18px] py-4" style={{ backgroundColor: "#E6EFEA" }}>
            <View className="flex-row items-center gap-2.5">
              <CircleCheck size={17} color="#14513F" strokeWidth={2} />
              <Text className="font-ui-medium text-[14.5px]" style={{ color: "#14513F" }}>
                {brokenCount > 0
                  ? `${brokenCount} connection${brokenCount === 1 ? "" : "s"} needs attention`
                  : allSynced
                    ? "All accounts synced"
                    : "Sync in progress"}
              </Text>
            </View>
            <ChevronRight size={16} color="#14513F" strokeWidth={1.75} />
          </View>
        </Pressable>

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
                  style={i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: "rgba(228,225,217,0.55)" } : undefined}
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
                  style={i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: "rgba(228,225,217,0.55)" } : undefined}
                >
                  <View className="gap-0.5 flex-1 pr-3">
                    <Text className="font-ui-semibold text-[15px] text-text" numberOfLines={1}>
                      {t.merchantName ?? t.name}
                    </Text>
                  </View>
                  <MoneyText cents={t.amount} signed className="text-[15px] font-ui-medium" style={{ color: amountColor(t.amount) }} />
                </View>
              ))
            )}
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}
