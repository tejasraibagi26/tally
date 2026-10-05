import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { budgetRowState, type MonthContext } from "@tally/core/budgetView";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { SplitMoney } from "@/components/ui/SplitMoney";
import { fmtBudget, toneColorFor } from "@/components/budgets/BudgetRowItem";
import { usePrivacy } from "@/lib/PrivacyContext";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

function deltaLabel(current: number, prior: number | undefined): string | undefined {
  if (!prior) return undefined;
  const pct = Math.round((Math.abs(current - prior) / Math.abs(prior)) * 100);
  return `${current >= prior ? "+" : "-"}${pct}% vs last month`;
}

/**
 * This month in one card: what's been spent against the month's budget (the
 * same bar rules as a budget row, plus a tick for how far through the month
 * it is -- no projections or pace verdicts), then income and what's left of it. Income and Saved mask with the privacy toggle (Saved would
 * reveal income); Spent and the budget don't.
 */
export function MonthCard({
  spend,
  income,
  priorIncome,
  totalBudgeted,
  daysElapsed,
  daysInMonth,
}: {
  spend: number;
  income: number;
  priorIncome?: number;
  totalBudgeted: number;
  daysElapsed: number;
  daysInMonth: number;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const { hidden } = usePrivacy();

  const ctx: MonthContext = { phase: "current", daysElapsed, daysInMonth };
  const budget = totalBudgeted > 0 ? budgetRowState({ amount: totalBudgeted, rolloverFromPrior: 0, isFixedAmount: false, spend }, ctx, fmtBudget) : null;
  const usedPct = totalBudgeted > 0 ? Math.round((spend / totalBudgeted) * 100) : 0;
  const saved = income - spend;
  const fill = budget?.barTone === "warning" ? colors.warning : colors.brand;

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>This month</Text>
        <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>Day {daysElapsed} of {daysInMonth}</Text>
      </View>
      <Card className="p-5">
        <View className="flex-row items-end justify-between gap-3">
          <View className="gap-1.5 flex-shrink">
            <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5) }}>Spent</Text>
            <SplitMoney cents={spend} mask={false} size={32} centsSize={18} lineHeight={34} />
          </View>
          {budget && <Text className="font-ui text-text-3 pb-1" style={{ fontSize: rf(12.5) }}>of {fmtBudget(totalBudgeted)} budget</Text>}
        </View>

        {budget ? (
          <View className="mt-3.5">
            <View>
              <View className="h-2 rounded-full bg-sunken flex-row overflow-hidden">
                <View style={{ width: `${budget.fillPct * 100}%`, backgroundColor: fill }} />
                {budget.overPct > 0 && <View style={{ width: `${budget.overPct * 100}%`, backgroundColor: colors.negative }} />}
              </View>
              {budget.pacePct != null && (
                <View style={{ position: "absolute", left: `${budget.pacePct * 100}%`, top: -3, width: 2, height: 14, borderRadius: 1, backgroundColor: colors.text, opacity: 0.5 }} />
              )}
            </View>
            <View className="flex-row justify-between mt-2.5">
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>{usedPct}% used</Text>
              <Text className="font-ui" style={{ fontSize: rf(12), color: toneColorFor(colors, budget.labelTone === "default" ? "muted" : budget.labelTone) }}>
                {budget.label}
              </Text>
            </View>
          </View>
        ) : (
          <Pressable onPress={() => router.push("/(tabs)/budgets")} hitSlop={8} className="mt-3 self-start" accessibilityRole="link">
            <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>Set a budget</Text>
          </Pressable>
        )}

        <View className="mt-4 pt-4 flex-row gap-3" style={{ borderTopWidth: 1, borderTopColor: hairline(colors) }}>
          <View className="flex-1 gap-1.5">
            <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5) }}>Income</Text>
            <MoneyText cents={income} className="font-ui-semibold text-text" style={{ fontSize: rf(19) }} numberOfLines={1} adjustsFontSizeToFit />
            {deltaLabel(income, priorIncome) && <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }} numberOfLines={1}>{deltaLabel(income, priorIncome)}</Text>}
          </View>
          <View className="flex-1 gap-1.5">
            <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5) }}>Saved</Text>
            <MoneyText
              cents={saved}
              signed
              className="font-ui-semibold"
              style={{ fontSize: rf(19), color: saved >= 0 ? colors.positive : colors.negative }}
              numberOfLines={1}
              adjustsFontSizeToFit
            />
            {income > 0 && !hidden && <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }} numberOfLines={1}>{Math.round((saved / income) * 100)}% of income</Text>}
          </View>
        </View>
      </Card>
    </View>
  );
}
