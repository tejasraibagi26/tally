import { View, Text, Pressable } from "react-native";
import { formatCents } from "@tally/core/money";
import { budgetRowState, type LabelTone, type MonthContext } from "@tally/core/budgetView";
import type { BudgetLine } from "@/lib/queries/budgets";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

export function fmtBudget(c: number): string {
  return formatCents(c).replace(/\.00$/, "");
}

export function toneColorFor(colors: ReturnType<typeof useThemeColors>, tone: LabelTone): string {
  return tone === "warning" ? colors.warning! : tone === "negative" ? colors.negative! : tone === "positive" ? colors.positive! : tone === "muted" ? colors["text-3"]! : colors.text!;
}

/**
 * One budget row: name, "$142 of $600 · $458 left", a bar in the budget's
 * own color (amber 80-<100%, red overage) with a pace tick, and a note.
 * All of it from @tally/core/budgetView, the same rules web renders.
 */
export function BudgetRowItem({ line, ctx, color, showTopBorder, onPress }: { line: BudgetLine; ctx: MonthContext; color: string; showTopBorder: boolean; onPress: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const s = budgetRowState(line, ctx, fmtBudget);
  const fill = s.barTone === "warning" ? colors.warning : color;
  return (
    <Pressable onPress={onPress} className="px-5 py-3.5 gap-2 active:bg-surface-2" style={showTopBorder ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}>
      <View className="flex-row items-baseline justify-between gap-3">
        <View className="flex-row items-center gap-2 flex-1">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Text className="font-ui-medium text-text flex-shrink" style={{ fontSize: rf(14.5) }} numberOfLines={1}>{line.categoryName}</Text>
          {line.isFixedAmount && (
            <View className="rounded-full bg-surface-2 px-2 py-0.5">
              <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(10.5) }}>Fixed</Text>
            </View>
          )}
        </View>
        <Text className="font-ui-semibold" style={{ fontSize: rf(13), color: s.labelTone === "default" ? colors.text : toneColorFor(colors, s.labelTone), fontVariant: ["tabular-nums"] }}>{s.label}</Text>
      </View>
      <View className="h-2 rounded-full bg-sunken flex-row overflow-hidden">
        <View style={{ width: `${s.fillPct * 100}%`, backgroundColor: fill }} />
        {s.overPct > 0 && <View style={{ width: `${s.overPct * 100}%`, backgroundColor: colors.negative }} />}
        {s.pacePct != null && <View style={{ position: "absolute", left: `${s.pacePct * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: colors.text, opacity: 0.5 }} />}
      </View>
      <View className="flex-row justify-between">
        <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5), fontVariant: ["tabular-nums"] }}>
          {fmtBudget(line.spend)} of {fmtBudget(s.available)}
          {line.rolloverFromPrior > 0 ? ` · +${fmtBudget(line.rolloverFromPrior)} rolled over` : ""}
        </Text>
        {s.note && <Text className="font-ui" style={{ fontSize: rf(11.5), color: toneColorFor(colors, s.noteTone) }}>{s.note}</Text>}
      </View>
    </Pressable>
  );
}
