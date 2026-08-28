import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { MeterBar } from "@/components/ui/MeterBar";
import { MoneyText } from "@/components/ui/MoneyText";
import { useBudgets, currentMonthParam } from "@/lib/queries/budgets";
import { useThemeColors } from "@/theme/useThemeColors";

function shiftMonth(month: string, delta: number): string {
  const d = new Date(month + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

// MOBILE_DESIGN.md §5.6 -- month stepper, meter rows, footer totals pinned
// above the tab bar. The pin-above-scroll behavior is deferred (needs a
// fixed footer outside the ScrollView); totals render inline for now.
export default function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [month, setMonth] = useState(currentMonthParam());
  const { data, isLoading, refetch, isRefetching } = useBudgets(month);

  const totalSpend = data?.budgets.reduce((s, b) => s + b.spend, 0) ?? 0;
  const totalBudget = data?.budgets.reduce((s, b) => s + b.amount + b.rolloverFromPrior, 0) ?? 0;

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
    >
      <View className="px-5 pb-4">
        <Text className="font-ui-semibold text-[24px] text-text mb-3" style={{ letterSpacing: -0.3 }}>
          Budgets
        </Text>
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, -1))} hitSlop={12}>
            <ChevronLeft size={20} color={colors["text-2"]} />
          </Pressable>
          <Text className="font-ui-semibold text-[15px] text-text">{monthLabel(month)}</Text>
          <Pressable onPress={() => setMonth((m) => shiftMonth(m, 1))} hitSlop={12}>
            <ChevronRight size={20} color={colors["text-2"]} />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <View className="px-5 gap-4">
          <Card className="p-5 flex-row justify-between items-center">
            <Text className="font-ui text-[13.5px] text-text-2">Total this month</Text>
            <Text className="font-ui-semibold text-[14.5px] text-text">
              <MoneyText cents={totalSpend} /> of <MoneyText cents={totalBudget} />
            </Text>
          </Card>

          <Card className="p-5 gap-6">
            {data && data.budgets.length > 0 ? (
              data.budgets.map((b) => (
                <MeterBar key={b.categoryId} label={b.categoryName} colorSlot={b.categoryColorSlot} spentCents={b.spend} budgetCents={b.amount + b.rolloverFromPrior} />
              ))
            ) : (
              <Text className="font-ui text-[14px] text-text-3">No budgets set for this month.</Text>
            )}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
