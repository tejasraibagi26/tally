import { Text, View } from "react-native";
import { PACE_MONTHS } from "@tally/core/goalMath";
import { Card } from "@/components/ui/Card";
import { usePrivateMoney } from "@/components/overview/GoalCard";
import type { CashFlowMonth } from "@/lib/queries/cashflow";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/** Plot height. Bars and the requirement line share this one scale. */
const PLOT = 96;

function shortMonth(month: string): string {
  return new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
}

/**
 * What you have actually saved, month by month, against what the goal needs.
 * Mirrors apps/web/components/goalview/SavingLedger.tsx.
 *
 * Income minus spend for a month is what was saved that month, by the same
 * definition goalMath's savingPace averages, so the series comes straight
 * off the cash flow endpoint with no new pipeline. Deliberately a record
 * rather than a streak: amounts against a requirement, with the months that
 * drive the verdict above marked.
 */
export function SavingLedger({
  months,
  neededPerMonth,
  currentMonth,
}: {
  months: CashFlowMonth[];
  neededPerMonth: number | null | undefined;
  /** The month in progress, which is not finished and not in the pace window. */
  currentMonth: string;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const money = usePrivateMoney();
  if (months.length === 0) return null;

  // The pace window is the PACE_MONTHS full months before this one.
  const windowStart = (() => {
    const d = new Date(`${currentMonth}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - PACE_MONTHS);
    return d.toISOString().slice(0, 10);
  })();

  const rows = months.map((m) => ({
    month: m.month,
    saved: m.income - m.spend,
    inProgress: m.month === currentMonth,
    inPaceWindow: m.month >= windowStart && m.month < currentMonth,
  }));

  const peak = Math.max(neededPerMonth ?? 0, ...rows.map((r) => Math.abs(r.saved)), 1);
  const scale = peak / 0.9;
  const height = (cents: number) => Math.max(2, Math.round((Math.max(0, cents) / scale) * PLOT));
  const needBottom = neededPerMonth != null ? Math.round((neededPerMonth / scale) * PLOT) : null;

  const full = rows.filter((r) => !r.inProgress);
  const reached = neededPerMonth != null ? full.filter((r) => r.saved >= neededPerMonth).length : null;

  return (
    <Card className="p-4">
      <Text className="font-ui-semibold uppercase" style={{ fontSize: rf(11), letterSpacing: 0.7, color: colors["text-3"] }}>
        What you&apos;ve actually saved
      </Text>

      <View style={{ marginTop: 22 }}>
        <View className="flex-row items-end" style={{ height: PLOT, gap: 8 }}>
          {needBottom != null && (
            <View
              style={{ position: "absolute", left: 0, right: 0, bottom: needBottom, borderTopWidth: 1, borderStyle: "dashed", borderTopColor: colors["border-strong"] }}
            />
          )}
          {rows.map((r) => (
            <View key={r.month} className="flex-1 items-center justify-end" style={{ height: PLOT }}>
              <Text
                className={r.inPaceWindow ? "font-ui-semibold" : "font-ui"}
                style={{ fontSize: rf(10.5), color: r.inPaceWindow ? colors.text : colors["text-2"], marginBottom: 4 }}
                numberOfLines={1}
              >
                {money(r.saved)}
              </Text>
              <View
                style={{
                  width: "100%",
                  height: height(r.saved),
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: r.inPaceWindow ? colors.brand : colors["brand-subtle"],
                  opacity: r.inProgress ? 0.6 : 1,
                }}
              />
            </View>
          ))}
        </View>
        <View className="flex-row" style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 }}>
          {rows.map((r) => (
            <Text
              key={r.month}
              className="font-ui-semibold flex-1 text-center"
              style={{ fontSize: rf(10), letterSpacing: 0.4, color: r.inProgress ? colors["text-2"] : colors["text-3"] }}
            >
              {shortMonth(r.month)}
            </Text>
          ))}
        </View>
      </View>

      {neededPerMonth != null && (
        <Text className="font-ui" style={{ fontSize: rf(12.5), color: colors["text-2"], marginTop: 12 }}>
          <Text className="font-ui-semibold" style={{ color: colors.text }}>
            Solid bars are the {PACE_MONTHS} months your pace is measured over.
          </Text>{" "}
          {reached === 0
            ? "No full month on file has reached what the goal needs."
            : `${reached} of the last ${full.length} full months reached what the goal needs.`}
        </Text>
      )}
    </Card>
  );
}
