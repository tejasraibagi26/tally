import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { Stack } from "expo-router";
import { AddBillSheet } from "@/components/AddBillSheet";
import { subscriptionsMonthlyTotal } from "@tally/core/subscriptionMath";
import { HeaderTextAction } from "@/components/ui/HeaderTextAction";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { useSubscriptions, useDeleteSubscription, useSetAmortizeMonthly, type RecurringStream } from "@/lib/queries/subscriptions";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { Trash2, Check, SplitSquareVertical } from "lucide-react-native";

const TERM_OPTIONS = [3, 6, 9, 12];

// Same "chip, not plain text" treatment as web's AmortizeToggle.tsx --
// offered for anything charged less often than monthly (a prepaid 3/6/9/12-
// month plan). Once on, a row of term pills picks how many months the charge
// covers; it's split evenly across those months.
function AmortizeChip({ stream }: { stream: RecurringStream }) {
  const rf = useRF();
  const colors = useThemeColors();
  const setAmortize = useSetAmortizeMonthly();
  const term = stream.amortizeMonths ?? 12;

  return (
    <View className="gap-1.5 mt-1">
      <Pressable
        onPress={() => setAmortize.mutate({ id: stream.id, amortizeMonthly: !stream.amortizeMonthly })}
        disabled={setAmortize.isPending}
        className="flex-row items-center gap-1 self-start px-2 rounded-full disabled:opacity-40"
        style={{
          height: 22,
          backgroundColor: stream.amortizeMonthly ? colors["positive-subtle"] : colors["brand-subtle"],
          borderWidth: stream.amortizeMonthly ? 0 : 1,
          borderStyle: "dashed",
          borderColor: colors["brand-border"],
        }}
      >
        {stream.amortizeMonthly ? (
          <Check size={10} color={colors.positive} strokeWidth={2.5} />
        ) : (
          <SplitSquareVertical size={10} color={colors.brand} strokeWidth={2} />
        )}
        <Text className="font-ui-medium" style={{ fontSize: rf(11), color: stream.amortizeMonthly ? colors.positive : colors.brand }}>
          {setAmortize.isPending ? "…" : stream.amortizeMonthly ? `Spread across ${term} months` : "Spread across months?"}
        </Text>
      </Pressable>
      {stream.amortizeMonthly && (
        <View className="flex-row gap-1.5">
          {TERM_OPTIONS.map((m) => {
            const selected = m === term;
            return (
              <Pressable
                key={m}
                onPress={() => !selected && setAmortize.mutate({ id: stream.id, amortizeMonths: m })}
                disabled={setAmortize.isPending}
                hitSlop={4}
                className="px-2 rounded-full items-center justify-center disabled:opacity-40"
                style={{ height: 22, backgroundColor: selected ? colors.positive : colors["positive-subtle"] }}
              >
                <Text className="font-ui-medium" style={{ fontSize: rf(11), color: selected ? colors["on-brand"] : colors.positive }}>
                  {m} mo
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const FREQUENCY_LABEL: Record<RecurringStream["frequency"], string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

// MOBILE_DESIGN.md §5.7 -- flat list (not grouped by institution), header
// totals for monthly/annualized spend, at-risk/cancelled get the same
// status-badge treatment as connection health.
export default function SubscriptionsScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const { data, isLoading } = useSubscriptions();
  const deleteSubscription = useDeleteSubscription();
  const [addOpen, setAddOpen] = useState(false);
  const streams = (data?.streams ?? []).filter((s) => s.status !== "cancelled");

  function confirmRemove(s: RecurringStream) {
    Alert.alert(`Remove "${s.description ?? s.merchantKey}"?`, "Transactions it already posted stay in your history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteSubscription.mutate(s.id) },
    ]);
  }

  // Same total as web's Subscriptions page and the recap email
  // (@tally/core/subscriptionMath): expense streams only, spread plans over
  // their term, and a cancelled stream with a manual due date still counts.
  const { monthlyTotal } = subscriptionsMonthlyTotal(data?.streams ?? []);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
    <Stack.Screen options={{ headerRight: () => <HeaderTextAction label="Add" onPress={() => setAddOpen(true)} />, unstable_headerRightItems: () => [{ type: "custom", element: <HeaderTextAction label="Add" onPress={() => setAddOpen(true)} />, hidesSharedBackground: true }] }} />
    <ScreenGlow />
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 40 }}>
      <Card className="p-5 flex-row justify-between">
        <View>
          <Text className="font-ui tracking-wide text-text-2" style={{ textTransform: "uppercase", fontSize: rf(11) }}>
            Monthly
          </Text>
          <MoneyText cents={Math.round(monthlyTotal)} className="font-display text-text" mask={false} style={{ fontSize: rf(24) }} />
        </View>
        <View>
          <Text className="font-ui tracking-wide text-text-2" style={{ textTransform: "uppercase", fontSize: rf(11) }}>
            Annualized
          </Text>
          <MoneyText cents={Math.round(monthlyTotal * 12)} className="font-display text-text" mask={false} style={{ fontSize: rf(24) }} />
        </View>
      </Card>
      {(data?.streams ?? []).some((s) => s.isManual && s.averageAmount < 0) && (
        <Text className="font-ui text-text-3" style={{ fontSize: rf(12), marginTop: -12 }}>
          Bills you added yourself, like rent, aren&apos;t included in these totals.
        </Text>
      )}

      {isLoading ? (
        <ActivityIndicator />
      ) : (
        <Card className="px-5">
          {streams.map((s, i, arr) => (
            <View
              key={s.id}
              className="flex-row items-center justify-between py-4"
              style={i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
            >
              <View className="gap-0.5 flex-1 pr-3">
                <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15) }} numberOfLines={1}>
                  {s.description ?? s.merchantKey}
                </Text>
                <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>
                  {s.amortizeMonthly ? `Every ${s.amortizeMonths ?? 12} months` : FREQUENCY_LABEL[s.frequency]}
                  {s.status === "at_risk" ? " · At risk" : ""}
                </Text>
                {(s.amortizeMonthly || s.frequency === "annual" || s.frequency === "quarterly") && s.averageAmount < 0 && <AmortizeChip stream={s} />}
              </View>
              <MoneyText cents={s.averageAmount} className="text-text" mask={false} style={{ fontSize: rf(14.5) }} />
              <Pressable onPress={() => confirmRemove(s)} hitSlop={10} className="ml-3">
                <Trash2 size={16} color={colors["text-3"]} />
              </Pressable>
            </View>
          ))}
          {streams.length === 0 && <Text className="font-ui text-text-3 py-4" style={{ fontSize: rf(14) }}>No subscriptions detected yet. Paid in irregular lump sums, like rent prepaid ahead? Tap Add to track it.</Text>}
        </Card>
      )}
    </ScrollView>
    <AddBillSheet visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}
