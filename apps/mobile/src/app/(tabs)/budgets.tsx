import { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Plus, PiggyBank } from "lucide-react-native";
import { monthLastDay } from "@tally/core/budgetMath";
import { Card } from "@/components/ui/Card";
import { MeterBar } from "@/components/ui/MeterBar";
import { MoneyText } from "@/components/ui/MoneyText";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBudgets, currentMonthParam, type BudgetLine } from "@/lib/queries/budgets";
import { useThemeColors } from "@/theme/useThemeColors";
import { hairline, chartSeries } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useTabBarBottomClearance } from "@/lib/useTabBarBottomClearance";
import { useRF } from "@/theme/responsiveFont";
import { AddBudgetSheet } from "@/components/AddBudgetSheet";

function shiftMonth(month: string, delta: number): string {
  const d = new Date(month + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function daysInMonthOf(month: string): number {
  const d = new Date(month + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

// MOBILE_DESIGN.md §5.6, revised: every budget lives in one grouped card
// (hairline-divided rows, not a card apiece), and the Budgeted/Spent/
// Remaining summary is that card's own header -- "left to spend", a single
// total bar segmented by category, and a one-line count/progress caption --
// rather than a separate strip above the list. Still deferred: swipe-left/
// right month navigation, and parent-category grouping/"copy last month"
// bulk actions (neither exists on web either).
export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarBottomClearance();
  const colors = useThemeColors();
  const rf = useRF();
  const router = useRouter();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const [month, setMonth] = useState(currentMonthParam());
  const { data, isLoading, isError, refetch, isRefetching } = useBudgets(month);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetLine | null>(null);

  const budgets = data?.budgets ?? [];
  const hasBudgets = budgets.length > 0;
  const totalSpend = budgets.reduce((s, b) => s + b.spend, 0);
  const totalBudget = budgets.reduce((s, b) => s + b.amount + b.rolloverFromPrior, 0);
  const totalRemaining = totalBudget - totalSpend;

  const isCurrentMonth = month === currentMonthParam();
  const daysElapsed = new Date().getUTCDate();
  const daysInMonth = daysInMonthOf(month);
  const spentPct = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;
  const daysLeft = daysInMonth - daysElapsed;

  function openTransactionsFor(budget: BudgetLine) {
    router.push({
      pathname: "/(tabs)/transactions",
      params: { category: budget.categoryId, from: month, to: monthLastDay(month) },
    });
  }

  return (
    <View className="flex-1 bg-canvas">
      <ScreenGlow />
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 + tabBarClearance }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      >
        <View className="px-5 pb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(24) }}>
              Budgets
            </Text>
            <Pressable onPress={() => setAddOpen(true)} hitSlop={12} className="items-center justify-center rounded-full bg-brand" style={{ width: 34, height: 34 }}>
              <Plus size={18} color={colors["on-brand"]} strokeWidth={2.3} />
            </Pressable>
          </View>
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))} hitSlop={12}>
              <ChevronLeft size={20} color={colors["text-2"]} />
            </Pressable>
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }}>{monthLabel(month)}</Text>
            <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))} hitSlop={12}>
              <ChevronRight size={20} color={colors["text-2"]} />
            </Pressable>
          </View>

        </View>

        {isLoading ? (
          <View className="px-5">
            <Skeleton style={{ height: 360, borderRadius: 18 }} />
          </View>
        ) : isError ? (
          <View className="px-5">
            <View className="rounded-card bg-surface p-8 items-center gap-3">
              <Text className="font-ui text-text-2 text-center" style={{ fontSize: rf(14) }}>Couldn't load budgets.</Text>
              <Pressable onPress={() => refetch()} className="rounded-full bg-brand-subtle px-4 py-2">
                <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : hasBudgets ? (
          <View className="px-5">
            <Card className="overflow-hidden">
              <View className="px-5 pt-5 pb-[18px] gap-3" style={{ borderBottomWidth: 1, borderBottomColor: hairline(colors) }}>
                <View className="flex-row items-end justify-between">
                  <View className="gap-0.5">
                    <Text className="font-ui text-text-3" style={{ fontSize: rf(10), letterSpacing: 0.4, textTransform: "uppercase" }}>
                      {totalRemaining < 0 ? "Over budget" : "Left to spend"}
                    </Text>
                    <MoneyText
                      cents={Math.abs(totalRemaining)}
                      mask={false}
                      className="font-ui-semibold"
                      style={{ fontSize: rf(28), letterSpacing: -0.5, color: totalRemaining < 0 ? colors.negative : colors.text }}
                    />
                  </View>
                  <Text className="font-ui text-text-2 pb-1" style={{ fontSize: rf(13) }}>
                    <MoneyText cents={totalSpend} mask={false} /> of <MoneyText cents={totalBudget} mask={false} />
                  </Text>
                </View>
                {/* Each category's within-budget spend, in its series color, as a
                    share of the month's total budget -- overage isn't drawn here
                    (the row below already calls it out), so the bar never
                    exceeds 100%. */}
                <View className="h-2.5 rounded-full bg-sunken flex-row overflow-hidden" style={{ gap: 2 }}>
                  {totalBudget > 0 &&
                    budgets.map((b) => {
                      const w = (Math.min(b.spend, b.amount + b.rolloverFromPrior) / totalBudget) * 100;
                      if (w <= 0) return null;
                      return <View key={b.categoryId} style={{ width: `${w}%`, backgroundColor: series[(b.categoryColorSlot - 1) % series.length] ?? series[0] }} />;
                    })}
                </View>
                <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>
                  {budgets.length} {budgets.length === 1 ? "category" : "categories"} · {spentPct}% spent
                  {isCurrentMonth ? ` · ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left` : ""}
                </Text>
              </View>
              {budgets.map((b, i) => (
                <Pressable
                  key={b.categoryId}
                  onPress={() => setEditing(b)}
                  className="px-5 py-4"
                  style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
                >
                  <MeterBar
                    label={b.categoryName}
                    colorSlot={b.categoryColorSlot}
                    spentCents={b.spend}
                    budgetCents={b.amount + b.rolloverFromPrior}
                    rolloverCents={b.rolloverEnabled ? b.rolloverFromPrior : 0}
                    isFixedAmount={b.isFixedAmount}
                    daysElapsed={isCurrentMonth ? daysElapsed : undefined}
                    daysInMonth={isCurrentMonth ? daysInMonth : undefined}
                    mask={false}
                  />
                </Pressable>
              ))}
            </Card>
          </View>
        ) : (
          <View className="px-5">
            <View className="rounded-card bg-surface p-8 mt-2">
              <EmptyState
                icon={PiggyBank}
                title="No budgets yet"
                description={`Set one for ${monthLabel(month)} to start tracking spend against it.`}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <AddBudgetSheet
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        month={month}
        budgetedCategoryIds={budgets.map((b) => b.categoryId)}
      />
      {editing && (
        <AddBudgetSheet
          key={editing.categoryId}
          visible={editing != null}
          onClose={() => setEditing(null)}
          month={month}
          budgetedCategoryIds={budgets.map((b) => b.categoryId)}
          existing={editing}
          onViewTransactions={() => openTransactionsFor(editing)}
        />
      )}
    </View>
  );
}
