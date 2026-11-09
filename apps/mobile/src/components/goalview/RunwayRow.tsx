import { Pressable, Text, View } from "react-native";
import { budgetRunway, type RunwayContext } from "@tally/core/budgetRunway";
import { budgetStatus, type BudgetTone } from "@tally/core/budgetStatus";
import { goalCost } from "@tally/core/goalCost";
import { computeBurnRateProjection } from "@tally/core/budgetMath";
import type { BudgetLine } from "@/lib/queries/budgets";
import { fmtBudget } from "@/components/budgets/BudgetRowItem";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * What a budget is for: the user's own line when they've written one (set on
 * web's budget panel, stored on the category), otherwise what Tally can tell
 * on its own.
 */
function whatFor(line: BudgetLine): string | null {
  if (line.description) return line.description;
  const parts: string[] = [];
  if (line.parentName && line.parentName !== line.categoryName) parts.push(line.parentName);
  if (line.isFixedAmount) parts.push("fixed amount");
  if (line.rolloverFromPrior > 0) parts.push(`+${fmtBudget(line.rolloverFromPrior)} rolled over`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * One budget on the goal view: the name and what's left, a bar of what's
 * spent with a mark for today, and one status line from
 * @tally/core/budgetStatus. The goal cost rides on that line only when the
 * row has one. Mirrors web's BudgetsGoalView row (web v2.26.0).
 */
export function RunwayRow({
  line,
  ctx,
  neededPerMonth,
  month,
  showTopBorder,
  onPress,
}: {
  line: BudgetLine;
  ctx: RunwayContext;
  neededPerMonth: number | null;
  month: string;
  showTopBorder: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();

  const available = line.amount + line.rolloverFromPrior;
  const r = budgetRunway({ available, spend: line.spend, isFixedAmount: line.isFixedAmount }, ctx, fmtBudget);
  const projectedSpend =
    !line.isFixedAmount && ctx.daysElapsed != null ? computeBurnRateProjection(line.spend, ctx.daysElapsed, ctx.daysInMonth) : null;
  const cost = goalCost({
    over: Math.max(0, line.spend - available),
    projectedOver: projectedSpend != null ? Math.max(0, projectedSpend - available) : null,
    neededPerMonth,
    daysInMonth: ctx.daysInMonth,
  });

  const status = budgetStatus({ available, spend: line.spend, month }, r, cost, fmtBudget);
  // One meaning per colour, as on web: brand on track, marigold ahead of
  // pace, red over, grey settled.
  const FILL: Record<BudgetTone, string> = {
    ok: colors.brand!,
    ahead: colors.marigold!,
    over: colors.negative!,
    settled: colors["border-strong"]!,
  };
  const TEXT: Record<BudgetTone, string> = {
    ok: colors["text-2"]!,
    ahead: colors.warning!,
    over: colors.negative!,
    settled: colors["text-2"]!,
  };
  const sub = whatFor(line);

  return (
    <Pressable
      onPress={onPress}
      className="px-5 py-3.5 gap-2 active:bg-surface-2"
      style={showTopBorder ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
    >
      <View className="flex-row items-baseline justify-between" style={{ gap: 12 }}>
        <View className="flex-1">
          <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }} numberOfLines={1}>
            {line.categoryName}
          </Text>
          {sub && (
            <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }} numberOfLines={1}>
              {sub}
            </Text>
          )}
        </View>
        <View className="items-end">
          <Text
            className="font-display"
            style={{ fontSize: rf(19), color: r.left < 0 ? colors.negative : colors.text, fontVariant: ["tabular-nums"] }}
          >
            {r.left < 0 ? `−${fmtBudget(-r.left)}` : fmtBudget(r.left)}
          </Text>
          <Text className="font-ui text-text-3" style={{ fontSize: rf(10.5), fontVariant: ["tabular-nums"] }}>
            of {fmtBudget(available)}
          </Text>
        </View>
      </View>

      {/* What's spent, as a share of the budget; a fill past today's mark
          is spending ahead of the month. */}
      <View className="h-2 rounded-full bg-sunken">
        <View
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, width: `${status.spentPct * 100}%`, backgroundColor: FILL[status.tone] }}
        />
        {ctx.daysElapsed != null && (
          <View style={{ position: "absolute", left: `${r.todayPct * 100}%`, top: -3, bottom: -3, width: 2, borderRadius: 1, backgroundColor: colors.text }} />
        )}
      </View>

      <Text className="font-ui" style={{ fontSize: rf(12.5), color: TEXT[status.tone], fontVariant: ["tabular-nums"] }}>
        {status.text}
        {status.cost ? <Text style={{ color: colors.negative }}>{status.cost}</Text> : null}
      </Text>
    </Pressable>
  );
}
