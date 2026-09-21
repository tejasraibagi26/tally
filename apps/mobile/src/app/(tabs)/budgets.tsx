import { useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
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
import { hairline } from "@/theme/colors";
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

const FOOTER_HEIGHT = 60;

// MOBILE_DESIGN.md §5.6. Footer totals are pinned above the tab bar (an
// absolutely-positioned bar outside the ScrollView, not the ScrollView's own
// last child) so "Budgeted/Spent/Remaining" stays on screen while the
// category list scrolls independently -- this was deferred in the original
// cut; still deferred: swipe-left/right month navigation, and parent-category
// grouping/"copy last month" bulk actions (neither exists on web either).
export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarBottomClearance();
  const colors = useThemeColors();
  const rf = useRF();
  const router = useRouter();
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
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 + (hasBudgets ? FOOTER_HEIGHT : 0) + tabBarClearance }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
      >
        <View className="px-5 pb-4">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="font-ui-semibold text-text" style={{ letterSpacing: -0.3, fontSize: rf(24) }}>
              Budgets
            </Text>
            <Pressable onPress={() => setAddOpen(true)} hitSlop={12} className="items-center justify-center rounded-full bg-brand" style={{ width: 34, height: 34 }}>
              <Plus size={18} color={colors["on-brand"]} strokeWidth={2.3} />
            </Pressable>
          </View>
          {hasBudgets && (
            <Text className="font-ui text-text-2 mb-3" style={{ fontSize: rf(13) }}>
              {budgets.length} {budgets.length === 1 ? "category" : "categories"} budgeted
            </Text>
          )}
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
          <View className="px-5 gap-3">
            <Skeleton style={{ height: 76, borderRadius: 18 }} />
            <Skeleton style={{ height: 76, borderRadius: 18 }} />
            <Skeleton style={{ height: 76, borderRadius: 18 }} />
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
          <View className="px-5 gap-3">
            {budgets.map((b) => (
              <Pressable key={b.categoryId} onPress={() => setEditing(b)}>
                <Card className="p-5">
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
                </Card>
              </Pressable>
            ))}
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

      {hasBudgets && (
        <View
          className="absolute left-0 right-0 flex-row items-center justify-around bg-surface"
          style={{ bottom: tabBarClearance, height: FOOTER_HEIGHT, borderTopWidth: 1, borderTopColor: hairline(colors), paddingHorizontal: 12 }}
        >
          <View className="items-center">
            <Text className="font-ui text-text-3" style={{ fontSize: rf(10), letterSpacing: 0.4, textTransform: "uppercase" }}>Budgeted</Text>
            <MoneyText cents={totalBudget} mask={false} className="font-ui-semibold text-text" style={{ fontSize: rf(14) }} />
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: hairline(colors) }} />
          <View className="items-center">
            <Text className="font-ui text-text-3" style={{ fontSize: rf(10), letterSpacing: 0.4, textTransform: "uppercase" }}>Spent</Text>
            <MoneyText cents={totalSpend} mask={false} className="font-ui-semibold text-text" style={{ fontSize: rf(14) }} />
          </View>
          <View style={{ width: 1, height: 28, backgroundColor: hairline(colors) }} />
          <View className="items-center">
            <Text className="font-ui text-text-3" style={{ fontSize: rf(10), letterSpacing: 0.4, textTransform: "uppercase" }}>Remaining</Text>
            <MoneyText
              cents={Math.abs(totalRemaining)}
              mask={false}
              className="font-ui-semibold"
              style={{ fontSize: rf(14), color: totalRemaining < 0 ? colors.negative : colors.text }}
            />
          </View>
        </View>
      )}

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
