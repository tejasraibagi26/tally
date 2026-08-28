import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { MoneyText } from "@/components/ui/MoneyText";
import { chartSeries } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

interface MeterBarProps {
  label: string;
  colorSlot: number;
  spentCents: number;
  budgetCents: number;
  /** Passed through to MoneyText -- see its `mask` prop. Defaults to true
   * (Overview's "Budget this month" card masks); the Budgets tab passes
   * false, matching web's exclusion of budget figures from the toggle. */
  mask?: boolean;
}

// DESIGN.md §8 "Meter bar" -- track in sunken gray, fill in the category's
// series color, over-budget portion in negative. Series slot assignment is
// fixed order (chartSeries), never cycled or re-derived per screen.
export function MeterBar({ label, colorSlot, spentCents, budgetCents, mask = true }: MeterBarProps) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const seriesColor = series[(colorSlot - 1) % series.length] ?? series[0]!;
  const pct = budgetCents > 0 ? spentCents / budgetCents : 0;
  const overBudget = pct > 1;
  // When over budget the track represents total spend (100% = spentCents),
  // split into the within-budget portion (series color) and the overage
  // (negative) -- the two always sum to exactly 100%, so a plain flex-row
  // lays them out adjacent with no clipping. When under budget the track
  // represents budgetCents instead, filled only up to spend/budget.
  const goodPct = overBudget ? (budgetCents / spentCents) * 100 : Math.min(pct, 1) * 100;
  const overPct = overBudget ? 100 - goodPct : 0;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: seriesColor }} />
          <Text className="font-ui-medium text-[14px] text-text">{label}</Text>
        </View>
        <Text className="font-ui text-[13px]" style={{ color: overBudget ? colors.negative : colors["text-2"] }}>
          <MoneyText cents={spentCents} mask={mask} /> of <MoneyText cents={budgetCents} mask={mask} />
        </Text>
      </View>
      <View className="h-2 rounded-full bg-sunken flex-row overflow-hidden">
        <View style={{ width: `${goodPct}%`, backgroundColor: seriesColor }} />
        {overBudget && <View style={{ width: `${overPct}%`, backgroundColor: colors.negative }} />}
      </View>
    </View>
  );
}
