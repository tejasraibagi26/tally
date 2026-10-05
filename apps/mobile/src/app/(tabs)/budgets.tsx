import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import { monthLastDay } from "@tally/core/budgetMath";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { groupBudgets, monthSummary, type MonthContext } from "@tally/core/budgetView";
import { useBudgets, useBudgetSetup, currentMonthParam, type BudgetLine } from "@/lib/queries/budgets";
import { BudgetRowItem, fmtBudget } from "@/components/budgets/BudgetRowItem";
import { BudgetDetailSheet } from "@/components/budgets/BudgetDetailSheet";
import { useThemeColors } from "@/theme/useThemeColors";
import { chartSeries } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useTabBarBottomClearance } from "@/lib/useTabBarBottomClearance";
import { useRF } from "@/theme/responsiveFont";
import { AddBudgetSheet } from "@/components/AddBudgetSheet";
import { TabHeader } from "@/components/ui/TabHeader";

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

// MOBILE_DESIGN.md §5.6 (budgets redesign, mobile v1.18.0): "left to
// spend" with a per-day allowance up top, rows grouped by parent category
// with a pace tick on each bar, a "Not budgeted" row so the month adds up,
// one-tap setup for an empty month, and a detail sheet per budget. Row
// colors and labels come from @tally/core/budgetView, shared with web.
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
  const setup = useBudgetSetup();
  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const budgets = data?.budgets ?? [];
  const unbudgeted = data?.unbudgeted ?? [];
  const current = currentMonthParam();
  const now = new Date();
  const ctx: MonthContext = month === current ? { phase: "current", daysElapsed: now.getDate(), daysInMonth: daysInMonthOf(month) } : { phase: month < current ? "past" : "future" };
  const summary = monthSummary(budgets, ctx);
  const groups = groupBudgets(budgets);
  const unbudgetedTotal = unbudgeted.reduce((s, u) => s + u.spend, 0);
  const colorFor = (b: BudgetLine) => series[((b.colorSlot ?? b.categoryColorSlot) - 1) % series.length] ?? series[0]!;
  const open = budgets.find((b) => b.categoryId === openId) ?? null;
  const label = { fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" as const };

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
          <View className="mb-3">
            <TabHeader
              title="Budgets"
              meta={[
                budgets.length > 0 && `${budgets.length} ${budgets.length === 1 ? "category" : "categories"} budgeted`,
                summary.daysLeft != null && (summary.daysLeft <= 1 ? "Last day of the month" : `${summary.daysLeft - 1} days left`),
                ctx.phase === "past" && "Finished",
              ]}
              actions={
                <Pressable onPress={() => setAddOpen(true)} hitSlop={12} accessibilityLabel="Add budget" className="items-center justify-center rounded-full bg-brand" style={{ width: 34, height: 34 }}>
                  <Plus size={18} color={colors["on-brand"]} strokeWidth={2.3} />
                </Pressable>
              }
            />
          </View>
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))} hitSlop={12} accessibilityLabel="Previous month">
              <ChevronLeft size={20} color={colors["text-2"]} />
            </Pressable>
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }}>{monthLabel(month)}</Text>
            <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))} hitSlop={12} accessibilityLabel="Next month">
              <ChevronRight size={20} color={colors["text-2"]} />
            </Pressable>
          </View>
        </View>

        {isLoading ? (
          <View className="px-5 gap-4">
            <Skeleton style={{ height: 130, borderRadius: 18 }} />
            <Skeleton style={{ height: 320, borderRadius: 18 }} />
          </View>
        ) : isError ? (
          <View className="px-5">
            <View className="rounded-card bg-surface p-8 items-center gap-3">
              <Text className="font-ui text-text-2 text-center" style={{ fontSize: rf(14) }}>{"Couldn't load budgets."}</Text>
              <Pressable onPress={() => refetch()} className="rounded-full bg-brand-subtle px-4 py-2">
                <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>Retry</Text>
              </Pressable>
            </View>
          </View>
        ) : budgets.length > 0 ? (
          <View className="px-5 gap-4">
            <Card className="px-5 pt-5 pb-[18px] gap-2.5">
              {ctx.phase === "past" ? (
                <>
                  <Text className="font-ui-medium text-text-3" style={label}>{monthLabel(month).split(" ")[0]} · finished</Text>
                  <Text className="font-display" style={{ fontSize: rf(34), color: summary.left < 0 ? colors.negative : colors.positive }}>
                    {fmtBudget(Math.abs(summary.left))} {summary.left < 0 ? "over" : "under"}
                  </Text>
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>
                    {fmtBudget(summary.spent)} of {fmtBudget(summary.budgeted)}
                    {summary.overCount > 0 ? ` · ${summary.overCount} budget${summary.overCount === 1 ? "" : "s"} went over` : ""}
                  </Text>
                </>
              ) : (
                <>
                  <Text className="font-ui-medium text-text-3" style={label}>{summary.left < 0 ? "Over budget" : "Left to spend"}</Text>
                  <Text className="font-display" style={{ fontSize: rf(38), color: summary.left < 0 ? colors.negative : colors.text }}>{fmtBudget(Math.abs(summary.left))}</Text>
                  <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>
                    {summary.perDay != null ? `About ${fmtBudget(summary.perDay)} a day for ${summary.daysLeft} days · ` : ""}
                    {fmtBudget(summary.spent)} of {fmtBudget(summary.budgeted)} spent
                  </Text>
                </>
              )}
              {/* Each budget's within-budget spend in its own color, as a
                  share of the whole month's budget; the rest stays track. */}
              <View className="h-2.5 rounded-full bg-sunken flex-row overflow-hidden mt-1" style={{ gap: 2 }}>
                {summary.budgeted > 0 &&
                  budgets.map((b) => {
                    const w = (Math.min(b.spend, b.amount + b.rolloverFromPrior) / summary.budgeted) * 100;
                    return w > 0 ? <View key={b.categoryId} style={{ width: `${w}%`, backgroundColor: colorFor(b) }} /> : null;
                  })}
              </View>
            </Card>

            <Card className="overflow-hidden">
              {groups.map((g, gi) => (
                <View key={g.name} style={gi > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : undefined}>
                  <View className="flex-row justify-between px-5 pt-3.5 pb-1">
                    <Text className="font-ui-semibold text-text-3" style={label}>{g.name}</Text>
                    <Text className="font-ui text-text-3" style={{ fontSize: rf(12), fontVariant: ["tabular-nums"] }}>
                      {fmtBudget(g.spent)} of {fmtBudget(g.budgeted)}
                    </Text>
                  </View>
                  {g.lines.map((b, i) => (
                    <BudgetRowItem key={b.categoryId} line={b} ctx={ctx} color={colorFor(b)} showTopBorder={i > 0} onPress={() => setOpenId(b.categoryId)} />
                  ))}
                </View>
              ))}
              {unbudgeted.length > 0 && (
                <View className="px-5 py-3.5 gap-1 bg-sunken" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                  <View className="flex-row justify-between">
                    <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>Not budgeted</Text>
                    <Text className="font-ui-semibold text-text" style={{ fontSize: rf(14), fontVariant: ["tabular-nums"] }}>{fmtBudget(unbudgetedTotal)}</Text>
                  </View>
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }} numberOfLines={1}>
                    {unbudgeted.slice(0, 3).map((u) => `${u.categoryName} ${fmtBudget(u.spend)}`).join(" · ")}
                    {unbudgeted.length > 3 ? ` · +${unbudgeted.length - 3} more` : ""}
                  </Text>
                </View>
              )}
            </Card>
          </View>
        ) : (
          <View className="px-5">
            <Card className="px-5 pt-6 pb-5 gap-3">
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Set up {monthLabel(month).split(" ")[0]}</Text>
              <Text className="font-ui text-text-2" style={{ fontSize: rf(13.5), lineHeight: rf(19) }}>
                {data?.setup?.copy || data?.setup?.average ? "Start from what you did before. You can adjust any amount after." : "Add a budget for a category to start tracking spending against a limit."}
                {unbudgetedTotal > 0 && ctx.phase !== "future" ? ` You've spent ${fmtBudget(unbudgetedTotal)} so far.` : ""}
              </Text>
              {data?.setup?.copy && (
                <Pressable onPress={() => setup.mutate({ month, source: "copy" })} disabled={setup.isPending} className="h-12 rounded-full items-center justify-center bg-brand mt-1">
                  <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14) }}>
                    Copy {monthLabel(data.setup.copy.fromMonth).split(" ")[0]} · {data.setup.copy.count} budgets, {fmtBudget(data.setup.copy.total)}
                  </Text>
                </Pressable>
              )}
              {data?.setup?.average && (
                <Pressable onPress={() => setup.mutate({ month, source: "average" })} disabled={setup.isPending} className="h-11 rounded-full items-center justify-center bg-brand-subtle">
                  <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(14) }}>Use 3-month averages · {fmtBudget(data.setup.average.total)}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setAddOpen(true)} className="items-center py-2">
                <Text className="font-ui-medium text-brand" style={{ fontSize: rf(13.5) }}>{data?.setup?.copy || data?.setup?.average ? "Start from scratch" : "Add a budget"}</Text>
              </Pressable>
            </Card>
          </View>
        )}
      </ScrollView>

      {toast && (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: tabBarClearance + 16, alignItems: "center" }}>
          <View className="flex-row items-center gap-4 rounded-full bg-raised px-4 py-2.5" style={{ borderWidth: 1, borderColor: colors.border }}>
            <Text className="font-ui-medium text-text" style={{ fontSize: rf(13) }}>{toast.text}</Text>
            {toast.undo && (
              <Pressable
                onPress={() => {
                  toast.undo!();
                  setToast(null);
                }}
                hitSlop={8}
              >
                <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>Undo</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <AddBudgetSheet visible={addOpen} onClose={() => setAddOpen(false)} month={month} budgetedCategoryIds={budgets.map((b) => b.categoryId)} />
      {open && (
        <BudgetDetailSheet
          key={open.categoryId}
          line={open}
          month={month}
          color={colorFor(open)}
          onClose={() => setOpenId(null)}
          onViewTransactions={() => {
            setOpenId(null);
            openTransactionsFor(open);
          }}
          onRemoved={(undo) => {
            setOpenId(null);
            setToast({ text: `${open.categoryName} removed`, undo });
          }}
        />
      )}
    </View>
  );
}
