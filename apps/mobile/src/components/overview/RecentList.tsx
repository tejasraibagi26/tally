import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { prettifyPfc } from "@tally/core/pfc";
import { DEFAULT_CURRENCY } from "@tally/core/fx";
import { shortDayLabel } from "@tally/core/overviewView";
import { describeTransactionRow } from "@tally/core/transactionView";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import type { TransactionRow } from "@/lib/queries/transactions";
import { todayISO } from "@/lib/today";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Last few transactions in the Transactions list's row grammar -- avatar,
 * merchant, the amber Pending chip, the needs-review dot, "Category · day",
 * signed amount -- minus its swipe actions and category picker. Tapping a
 * row opens the same detail screen.
 */
export function RecentList({ items }: { items: TransactionRow[] }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const today = todayISO();

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Recent activity</Text>
        <Pressable onPress={() => router.push("/(tabs)/transactions")} hitSlop={8}>
          <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>View all</Text>
        </Pressable>
      </View>
      <Card className="px-5">
        {items.length === 0 ? (
          <Text className="font-ui text-text-3 py-4" style={{ fontSize: rf(14) }}>Nothing here yet.</Text>
        ) : (
          items.map((t, i) => {
            const v = describeTransactionRow(
              {
                amount: t.amount,
                isPending: t.isPending,
                isTransfer: t.isTransfer ?? false,
                excludedFromBudget: t.excludedFromBudget,
                isManual: t.isManual,
                source: t.source ?? null,
                name: t.name,
                merchantName: t.merchantName,
                categoryId: t.categoryId,
                categoryKind: t.categoryKind ?? null,
                categorySource: t.categorySource ?? "plaid",
                splitCount: t.splits.length,
                recurringStreamId: t.recurringStreamId,
                reviewed: t.reviewed,
                currency: t.currency,
              },
              DEFAULT_CURRENCY,
            );
            const display = t.merchantName ?? t.name;
            const category = t.isTransfer ? "Transfer" : v.uncategorized ? "Uncategorized" : (t.categoryName ?? prettifyPfc(t.pfcDetailed));
            const amountColor = v.amountTone === "positive" ? colors.positive : v.amountTone === "muted" ? colors["text-3"] : colors.text;
            return (
              <Pressable
                key={t.id}
                onPress={() => router.push(`/(tabs)/transactions/${t.id}`)}
                className="flex-row items-center gap-3 py-3.5"
                style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
              >
                <View className="w-[30px] h-[30px] rounded-[9px] bg-surface-2 items-center justify-center">
                  <Text className="font-ui-semibold text-text-2" style={{ fontSize: rf(12) }}>{display.charAt(0).toUpperCase()}</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-1.5">
                    {v.needsReview && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand }} accessibilityLabel="Needs review" />}
                    <Text className="font-ui-medium flex-shrink" style={{ fontSize: rf(14.5), color: v.amountTone === "muted" ? colors["text-2"] : colors.text }} numberOfLines={1}>
                      {display}
                    </Text>
                    {v.mark?.kind === "pending" && (
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors["warning-subtle"] }}>
                        <Text className="font-ui-medium" style={{ fontSize: rf(10.5), color: colors.warning }}>Pending</Text>
                      </View>
                    )}
                  </View>
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }} numberOfLines={1}>
                    {category} · {shortDayLabel(t.postedDate, today)}
                  </Text>
                </View>
                <MoneyText
                  cents={t.amount}
                  signed
                  mask={false}
                  className="font-ui-semibold"
                  style={{ color: amountColor, fontSize: rf(14.5), textDecorationLine: v.struck ? "line-through" : "none" }}
                />
              </Pressable>
            );
          })
        )}
      </Card>
    </View>
  );
}
