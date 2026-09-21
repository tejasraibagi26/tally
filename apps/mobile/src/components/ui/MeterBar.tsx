import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { computeBurnRateProjection } from "@tally/core/budgetMath";
import { MoneyText } from "@/components/ui/MoneyText";
import { chartSeries } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

interface MeterBarProps {
  label: string;
  colorSlot: number;
  spentCents: number;
  budgetCents: number;
  /** Passed through to MoneyText -- see its `mask` prop. Defaults to true
   * (Overview's "Budget this month" card masks); the Budgets tab passes
   * false, matching web's exclusion of budget figures from the toggle. */
  mask?: boolean;
  /** Nonzero only when this month's rollover is enabled and prior months left something over -- draws the "+$X rollover" tag next to the label. Mirrors web's BudgetRow.tsx. */
  rolloverCents?: number;
  /** A fixed charge (rent, insurance) posts once rather than accruing daily, so the burn-rate projection below doesn't apply to it. */
  isFixedAmount?: boolean;
  /** Only meaningful, and only passed by the caller, for the month currently in progress -- projecting a past or future month is meaningless (WORK.md §9). */
  daysElapsed?: number;
  daysInMonth?: number;
}

// DESIGN.md §8 "Meter bar" -- track in sunken gray, fill in the category's
// series color under 80% of budget, --warning at >=80% and not yet over,
// --negative for the overage once truly over. Series slot assignment is
// fixed order (chartSeries), never cycled or re-derived per screen.
export function MeterBar({ label, colorSlot, spentCents, budgetCents, mask = true, rolloverCents = 0, isFixedAmount = false, daysElapsed, daysInMonth }: MeterBarProps) {
  const colors = useThemeColors();
  const rf = useRF();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const seriesColor = series[(colorSlot - 1) % series.length] ?? series[0]!;
  const pct = budgetCents > 0 ? spentCents / budgetCents : 0;
  const overBudget = pct > 1;
  const nearBudget = !overBudget && pct >= 0.8;
  // When over budget the track represents total spend (100% = spentCents),
  // split into the within-budget portion and the overage (negative) -- the
  // two always sum to exactly 100%, so a plain flex-row lays them out
  // adjacent with no clipping. When under budget the track represents
  // budgetCents instead, filled only up to spend/budget, in the category's
  // series color unless it's crossed the 80% line (then --warning).
  const goodPct = overBudget ? (budgetCents / spentCents) * 100 : Math.min(pct, 1) * 100;
  const overPct = overBudget ? 100 - goodPct : 0;
  const goodColor = overBudget ? seriesColor : nearBudget ? colors.warning : seriesColor;

  // Skips fixed-amount budgets entirely. Also skips an already-over-budget
  // row: its fill segments above are scaled against spentCents (not
  // budgetCents), so a marker computed as projected/budgetCents would sit on
  // a different scale and land in a visually wrong spot.
  const projected = !isFixedAmount && !overBudget && daysElapsed && daysInMonth ? computeBurnRateProjection(spentCents, daysElapsed, daysInMonth) : null;
  const projectedPct = projected != null && budgetCents > 0 ? Math.min(1, projected / budgetCents) * 100 : null;
  const projectedOver = projected != null && projected > budgetCents;
  // The dashed marker itself is a lightweight, always-on signal whenever a
  // projection is computable. The "Projected $X by month end" text only
  // earns its place when it says something the amount line doesn't already
  // -- a row still under budget today but trending over. (An already-over
  // row says so via "Overspent by $X" already; this branch can't fire for
  // one anyway since `projected` is null once overBudget is true.)
  const showProjectionCaption = projectedOver;

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5 flex-shrink" style={{ minWidth: 0 }}>
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: seriesColor }} />
          <Text className="font-ui-medium text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{label}</Text>
          {rolloverCents > 0 && (
            <Text className="font-ui text-brand" style={{ fontSize: rf(11) }} numberOfLines={1}>
              +<MoneyText cents={rolloverCents} mask={mask} /> rollover
            </Text>
          )}
        </View>
        <Text className="font-ui" style={{ color: overBudget ? colors.negative : colors["text-2"], fontSize: rf(13) }}>
          {overBudget ? (
            <>Overspent by <MoneyText cents={spentCents - budgetCents} mask={mask} /></>
          ) : (
            <><MoneyText cents={spentCents} mask={mask} /> of <MoneyText cents={budgetCents} mask={mask} /></>
          )}
        </Text>
      </View>
      <View style={{ position: "relative" }}>
        <View className="h-2 rounded-full bg-sunken flex-row overflow-hidden">
          <View style={{ width: `${goodPct}%`, backgroundColor: goodColor }} />
          {overBudget && <View style={{ width: `${overPct}%`, backgroundColor: colors.negative }} />}
        </View>
        {projectedPct != null && (
          <View
            style={{
              position: "absolute",
              top: -2,
              bottom: -2,
              left: `${projectedPct}%`,
              width: 2,
              borderLeftWidth: 2,
              borderLeftColor: colors["text-3"],
              borderStyle: "dashed",
            }}
          />
        )}
      </View>
      {showProjectionCaption && (
        <Text className="font-ui" style={{ color: colors.warning, fontSize: rf(12) }}>
          Projected <MoneyText cents={projected!} mask={mask} /> by month end
        </Text>
      )}
    </View>
  );
}
