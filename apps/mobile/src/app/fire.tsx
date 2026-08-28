import { useMemo, useState } from "react";
import { View, Text, ScrollView, TextInput } from "react-native";
import { fireNumber, yearsToFire } from "@tally/core/fireMath";
import { formatCents, formatPercent } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { useAccounts } from "@/lib/queries/accounts";

// MOBILE_DESIGN.md §5.8 -- pure UI over @tally/core's fireMath, recomputed
// live on every keystroke with zero server round-trip for the calculation
// itself (only persisting settings would need an API call -- not wired yet,
// this screen is read/compute-only for v1).
function Field({ label, value, onChangeText, suffix }: { label: string; value: string; onChangeText: (v: string) => void; suffix?: string }) {
  return (
    <View className="gap-1.5">
      <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
        {label}
      </Text>
      <View className="flex-row items-center h-14 rounded-control bg-surface-2 px-[18px]">
        <TextInput value={value} onChangeText={onChangeText} keyboardType="decimal-pad" className="flex-1 font-ui text-[15.5px] text-text" />
        {suffix && <Text className="font-ui text-[14px] text-text-3">{suffix}</Text>}
      </View>
    </View>
  );
}

export default function FireCalculatorScreen() {
  const { data: accounts } = useAccounts();
  const currentValueCents = accounts?.totals.net ?? 0;

  const [annualExpenses, setAnnualExpenses] = useState("60000");
  const [monthlyContribution, setMonthlyContribution] = useState("2000");
  const [swrPct, setSwrPct] = useState("4");
  const [returnPct, setReturnPct] = useState("7");

  const result = useMemo(() => {
    const expensesCents = Math.round((parseFloat(annualExpenses) || 0) * 100);
    const contributionCents = Math.round((parseFloat(monthlyContribution) || 0) * 100);
    const swr = (parseFloat(swrPct) || 4) / 100;
    const returnRate = (parseFloat(returnPct) || 7) / 100;

    const target = fireNumber(expensesCents, swr);
    const { years, alreadyThere } = yearsToFire({
      currentValue: currentValueCents,
      monthlyContribution: contributionCents,
      annualReturnRate: returnRate,
      targetValue: target,
    });

    return { target, years, alreadyThere };
  }, [annualExpenses, monthlyContribution, swrPct, returnPct, currentValueCents]);

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 60 }}>
      <Card className="p-6 gap-2 items-center">
        <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
          FIRE number
        </Text>
        <MoneyText cents={result.target} className="font-display text-[36px] text-text" />
        <Text className="font-ui text-[13.5px] text-text-2 mt-1">
          {result.alreadyThere
            ? "You've already reached it 🎉"
            : result.years != null
              ? `${result.years.toFixed(1)} years away`
              : "Not reachable with these inputs"}
        </Text>
        <Text className="font-ui text-[12.5px] text-text-3">
          Current: <MoneyText cents={currentValueCents} className="text-[12.5px] text-text-3" /> · {formatPercent((currentValueCents / result.target) || 0)} of the way
        </Text>
      </Card>

      <View className="gap-4">
        <Field label="Annual expenses ($)" value={annualExpenses} onChangeText={setAnnualExpenses} />
        <Field label="Monthly contribution ($)" value={monthlyContribution} onChangeText={setMonthlyContribution} />
        <Field label="Safe withdrawal rate" value={swrPct} onChangeText={setSwrPct} suffix="%" />
        <Field label="Expected annual return" value={returnPct} onChangeText={setReturnPct} suffix="%" />
      </View>
    </ScrollView>
  );
}
