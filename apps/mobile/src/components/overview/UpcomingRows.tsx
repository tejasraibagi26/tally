import { View, Text, Pressable } from "react-native";
import { Ellipsis } from "lucide-react-native";
import { dateTile, dueLabel, type DueLabel } from "@tally/core/overviewView";
import { formatCents } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import type { UpcomingBill } from "@/lib/queries/overview";
import { usePrivacy } from "@/lib/PrivacyContext";
import { todayISO } from "@/lib/today";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/** A bill Tally guessed from past charges, which the person can say won't recur. */
export function isGuessedBill(bill: UpcomingBill): boolean {
  return bill.canDismiss === true && !!bill.streamId;
}

/**
 * When a bill is due, in words. Past its date reads "Overdue · 2 days"; a
 * card the bank flags as past due while its date is still ahead reads plain
 * "Overdue".
 */
function dueFor(bill: UpcomingBill, today: string): DueLabel {
  const due = dueLabel(bill.dueDate, today);
  if (bill.overdue && !due.urgent) return { text: "Overdue", urgent: true, soon: true };
  return due;
}

/** Overdue bills first, then by date. */
export function sortBills(bills: UpcomingBill[]): UpcomingBill[] {
  return [...bills].sort((a, b) => Number(!!b.overdue) - Number(!!a.overdue) || a.dueDate.localeCompare(b.dueDate));
}

/**
 * One card of upcoming bills: date tile, label, when it's due, amount, and a
 * "⋯" on a guessed bill, whose row opens the won't-recur sheet via onSelect.
 * Shared by Overview's Upcoming section and the full Upcoming screen.
 */
export function UpcomingRows({ bills, onSelect }: { bills: UpcomingBill[]; onSelect: (bill: UpcomingBill) => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const today = todayISO();
  const { hidden } = usePrivacy();
  return (
    <Card className="px-5">
      {bills.map((bill, i) => {
        const tile = dateTile(bill.dueDate);
        const due = dueFor(bill, today);
        // A card's statement balance is context, not the amount due, and masks like any card balance.
        const round = (c: number) => formatCents(Math.round(c / 100) * 100).replace(/\.00$/, "");
        // A partly paid card says how much is in; the amount column is already what's left.
        const statement =
          bill.statementBalance == null || hidden
            ? ""
            : bill.paidSoFar
              ? ` · ${round(bill.paidSoFar)} of ${round(bill.statementBalance)} paid`
              : ` · statement ${round(bill.statementBalance)}`;
        const guessed = isGuessedBill(bill);
        const Row = guessed ? Pressable : View;
        return (
          <Row
            key={`${bill.streamId ?? bill.label}-${bill.dueDate}`}
            className="flex-row items-center gap-3 py-3.5"
            style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
            {...(guessed ? { onPress: () => onSelect(bill), accessibilityRole: "button" as const, accessibilityHint: "Opens options if this won't recur" } : {})}
          >
            <View className="w-10 h-11 rounded-[10px] bg-surface-2 items-center justify-center">
              <Text className="font-ui-semibold text-text-3" style={{ fontSize: rf(9.5), letterSpacing: 0.6 }}>{tile.month}</Text>
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }}>{tile.day}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }} numberOfLines={1}>{bill.label}</Text>
              <Text
                className={due.urgent ? "font-ui-medium" : "font-ui"}
                style={{ fontSize: rf(12), color: due.urgent ? colors.warning : due.soon ? colors["text-2"] : colors["text-3"] }}
                numberOfLines={1}
              >
                {due.text}
                {statement}
              </Text>
            </View>
            {bill.amount == null ? (
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }} accessibilityLabel="Minimum payment not reported">Min. unknown</Text>
            ) : (
              <MoneyText cents={bill.amount} mask={false} className="text-text" style={{ fontSize: rf(14.5) }} />
            )}
            {guessed && <Ellipsis size={18} color={colors["text-3"]} strokeWidth={1.75} />}
          </Row>
        );
      })}
    </Card>
  );
}
