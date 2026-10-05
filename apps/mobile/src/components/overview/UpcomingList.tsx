import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ellipsis } from "lucide-react-native";
import { dateTile, dueLabel } from "@tally/core/overviewView";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { UpcomingBillSheet } from "@/components/overview/UpcomingBillSheet";
import type { UpcomingBill } from "@/lib/queries/overview";
import { todayISO } from "@/lib/today";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

const SHOWN = 3;

/**
 * Next bills with a date tile and when each is due; "View all" only when more
 * exist. A bill Tally guessed from past charges opens a sheet where the person
 * can say it won't recur; card payments and bills they added have no guess to correct.
 */
export function UpcomingList({ bills }: { bills: UpcomingBill[] }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const [selected, setSelected] = useState<UpcomingBill | null>(null);
  if (bills.length === 0) return null;
  const today = todayISO();
  const sorted = [...bills].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const shown = sorted.slice(0, SHOWN);

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Upcoming</Text>
        {sorted.length > SHOWN && (
          <Pressable onPress={() => router.push("/subscriptions")} hitSlop={8}>
            <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>View all</Text>
          </Pressable>
        )}
      </View>
      <Card className="px-5">
        {shown.map((bill, i) => {
          const tile = dateTile(bill.dueDate);
          const due = dueLabel(bill.dueDate, today);
          const guessed = bill.canDismiss === true && !!bill.streamId;
          const Row = guessed ? Pressable : View;
          return (
            <Row
              key={`${bill.label}-${bill.dueDate}`}
              className="flex-row items-center gap-3 py-3.5"
              style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
              {...(guessed ? { onPress: () => setSelected(bill), accessibilityRole: "button" as const, accessibilityHint: "Opens options if this won't recur" } : {})}
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
                >
                  {due.text}
                </Text>
              </View>
              <MoneyText cents={bill.amount} mask={false} className="text-text" style={{ fontSize: rf(14.5) }} />
              {guessed && <Ellipsis size={18} color={colors["text-3"]} strokeWidth={1.75} />}
            </Row>
          );
        })}
      </Card>
      <UpcomingBillSheet bill={selected} onClose={() => setSelected(null)} />
    </View>
  );
}
