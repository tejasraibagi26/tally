import { Text, View } from "react-native";
import { PACE_MONTHS } from "@tally/core/goalMath";
import { Card } from "@/components/ui/Card";
import { usePrivateMoney } from "@/components/overview/GoalCard";
import type { GoalSummary } from "@/lib/queries/goals";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Why net worth is moving: the pace split into the half you steer and the
 * half you don't. Mirrors apps/web/components/goalview/PaceSplit.tsx.
 *
 * goalMath gives both numbers already. `pace` is the whole monthly movement,
 * `saving` is income minus spend over the same window, and the difference is
 * markets and debt paydown, which is not a decision anyone makes at a till.
 * Drawing them apart turns "you are behind" into "you are behind by this
 * much spending".
 */
const MARK_PCT = 0.88;

export function PaceSplit({ summary }: { summary: GoalSummary | undefined }) {
  const colors = useThemeColors();
  const rf = useRF();
  const money = usePrivateMoney();

  const p = summary?.projection;
  if (!p || p.pace == null) return null;

  const saving = p.saving;
  const other = saving != null ? p.pace - saving : null;
  const scale = Math.max(p.neededPerMonth ?? 0, p.pace, 1) / MARK_PCT;
  const pct = (cents: number) => `${Math.max(0, Math.min(100, (cents / scale) * 100))}%` as const;

  return (
    <Card className="p-4">
      <Text className="font-ui-semibold uppercase" style={{ fontSize: rf(11), letterSpacing: 0.7, color: colors["text-3"] }}>
        Why net worth is moving
      </Text>
      <Text className="font-ui" style={{ fontSize: rf(12), color: colors["text-3"], marginTop: 2 }}>
        Average month, last {PACE_MONTHS} full months
      </Text>

      <View style={{ marginTop: 22 }}>
        {p.neededPerMonth != null && (
          /* Hangs to the left of the mark, for the same reason as web. */
          <Text
            className="font-ui-semibold"
            numberOfLines={1}
            style={{ position: "absolute", top: -16, right: `${(1 - MARK_PCT) * 100}%`, paddingRight: 6, fontSize: rf(10.5), color: colors["text-3"] }}
          >
            needs {money(p.neededPerMonth)}
          </Text>
        )}
        <View className="flex-row overflow-hidden" style={{ height: 28, borderRadius: 8, backgroundColor: colors.sunken }}>
          {saving != null && saving > 0 && <View style={{ width: pct(saving), backgroundColor: colors.brand }} />}
          {other != null && other > 0 && <View style={{ width: pct(other), backgroundColor: colors["brand-subtle"] }} />}
          {saving == null && <View style={{ width: pct(p.pace), backgroundColor: colors.brand }} />}
        </View>
        {p.neededPerMonth != null && (
          <View
            style={{
              position: "absolute",
              top: -4,
              bottom: -4,
              left: `${MARK_PCT * 100}%`,
              width: 1,
              backgroundColor: colors["border-strong"],
            }}
          />
        )}
      </View>

      <View style={{ marginTop: 16, gap: 10 }}>
        {saving != null && (
          <View className="flex-row" style={{ gap: 9 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.brand, marginTop: 4 }} />
            <View className="flex-1">
              <Text className="font-ui-semibold" style={{ fontSize: rf(13), color: colors.text }}>
                {money(saving)} saved
              </Text>
              <Text className="font-ui" style={{ fontSize: rf(12), color: colors["text-3"] }}>
                Income minus everything you spent. The only half you steer.
              </Text>
            </View>
          </View>
        )}
        {other != null && (
          <View className="flex-row" style={{ gap: 9 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors["brand-subtle"], marginTop: 4 }} />
            <View className="flex-1">
              <Text className="font-ui-semibold" style={{ fontSize: rf(13), color: colors.text }}>
                {money(other)} markets and debt
              </Text>
              <Text className="font-ui" style={{ fontSize: rf(12), color: colors["text-3"] }}>
                Portfolio moves and principal paid down. Not a decision.
              </Text>
            </View>
          </View>
        )}
      </View>

      {p.shortBy != null && saving != null && (
        <Text
          className="font-ui"
          style={{ fontSize: rf(13), color: colors["text-2"], marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}
        >
          So the gap is not {money(p.shortBy)} of investing luck. It is{" "}
          <Text className="font-ui-semibold" style={{ color: colors.text }}>
            {money(p.shortBy)} a month of spending
          </Text>
          , which would take your saving to {money(saving + p.shortBy)}.
        </Text>
      )}
    </Card>
  );
}
