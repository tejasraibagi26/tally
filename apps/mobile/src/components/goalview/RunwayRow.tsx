import { Pressable, Text, View } from "react-native";
import { budgetRunway, type RunwayContext, type RunwayState } from "@tally/core/budgetRunway";
import { goalCost } from "@tally/core/goalCost";
import { computeBurnRateProjection } from "@tally/core/budgetMath";
import type { BudgetLine } from "@/lib/queries/budgets";
import { fmtBudget } from "@/components/budgets/BudgetRowItem";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/** "NOV 1", "NOV 30": the two ends of the runway's calendar. */
function monthEdge(month: string, day: number): string {
  return new Date(`${month.slice(0, 8)}${String(day).padStart(2, "0")}T00:00:00Z`)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

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
 * One budget on the goal view: the month as a bar with a mark for today and
 * a fill reaching as far as what's left lasts, the sentence from
 * @tally/core/budgetRunway with its verdict in bold, and what the row costs
 * the goal. Mirrors web's BudgetsGoalView row.
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

  const FILL: Record<RunwayState, string> = {
    carries: colors.brand!,
    untouched: colors.brand!,
    lands_short: colors.warning!,
    runs_dry: colors.negative!,
    over: colors.negative!,
    fixed: colors["border-strong"]!,
    not_current: colors["border-strong"]!,
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

      <View className="h-2 rounded-full bg-sunken overflow-hidden">
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${r.todayPct * 100}%`, backgroundColor: colors.border }} />
        <View style={{ position: "absolute", left: `${r.todayPct * 100}%`, top: 0, bottom: 0, width: `${r.carryPct * 100}%`, backgroundColor: FILL[r.state] }} />
        {r.todayPct > 0 && (
          <View style={{ position: "absolute", left: `${r.todayPct * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: colors.text }} />
        )}
      </View>

      {ctx.daysElapsed != null && (
        <View style={{ height: 13 }}>
          {r.todayPct > 0.16 && (
            <Text className="font-ui text-text-3" style={{ position: "absolute", left: 0, fontSize: rf(9.5), letterSpacing: 0.4 }}>
              {monthEdge(month, 1)}
            </Text>
          )}
          <Text
            className="font-ui-medium"
            style={{ position: "absolute", left: `${Math.min(88, Math.max(6, r.todayPct * 100))}%`, fontSize: rf(9.5), letterSpacing: 0.4, color: colors["text-2"] }}
          >
            TODAY
          </Text>
          {r.todayPct < 0.8 && (
            <Text className="font-ui text-text-3" style={{ position: "absolute", right: 0, fontSize: rf(9.5), letterSpacing: 0.4 }}>
              {monthEdge(month, ctx.daysInMonth)}
            </Text>
          )}
        </View>
      )}

      <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
        {r.parts.map((p, i) =>
          p.strong ? (
            <Text key={i} className="font-ui-semibold" style={{ color: colors.text }}>
              {p.text}
            </Text>
          ) : (
            <Text key={i}>{p.text}</Text>
          ),
        )}
      </Text>

      {cost.kind !== "none" && (
        <Text className="font-ui" style={{ fontSize: rf(11.5), color: colors["text-3"] }}>
          {cost.label && (
            <Text className="font-ui-semibold" style={{ color: colors.negative }}>
              {cost.label}{" "}
            </Text>
          )}
          {cost.note}
          {cost.label ? " off your goal date" : ""}
        </Text>
      )}
    </Pressable>
  );
}
