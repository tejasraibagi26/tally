import { View, Text, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { useSubscriptions, useDeleteSubscription, useSetAmortizeMonthly, type RecurringStream } from "@/lib/queries/subscriptions";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { Trash2, Check, SplitSquareVertical } from "lucide-react-native";

// Same "chip, not plain text" treatment as web's AmortizeToggle.tsx --
// annual only (the other cadences already post real monthly-ish charges of
// their own, nothing to smooth).
function AmortizeChip({ stream }: { stream: RecurringStream }) {
  const rf = useRF();
  const colors = useThemeColors();
  const setAmortize = useSetAmortizeMonthly();

  return (
    <Pressable
      onPress={() => setAmortize.mutate({ id: stream.id, amortizeMonthly: !stream.amortizeMonthly })}
      disabled={setAmortize.isPending}
      className="flex-row items-center gap-1 self-start px-2 rounded-full mt-1 disabled:opacity-40"
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
        {setAmortize.isPending ? "…" : stream.amortizeMonthly ? "Spread across months" : "Spread across months?"}
      </Text>
    </Pressable>
  );
}

const FREQUENCY_LABEL: Record<RecurringStream["frequency"], string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

const MONTHLY_MULTIPLIER: Record<RecurringStream["frequency"], number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
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
  const streams = (data?.streams ?? []).filter((s) => s.status !== "cancelled");

  function confirmRemove(s: RecurringStream) {
    const message = s.isManual
      ? "Transactions it already posted stay in your history."
      : "Transactions it already posted stay in your history, but it may come back automatically if the same charge keeps recurring.";
    Alert.alert(`Remove "${s.description ?? s.merchantKey}"?`, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => deleteSubscription.mutate(s.id) },
    ]);
  }

  // Matches the web Subscriptions page: only expense streams (negative
  // amounts) count toward Monthly/Annualized — a paycheck or other income
  // stream shouldn't inflate what looks like a spend total.
  const expenseStreams = streams.filter((s) => s.averageAmount < 0);
  const monthlyTotal = expenseStreams.reduce((sum, s) => sum + Math.abs(s.averageAmount) * MONTHLY_MULTIPLIER[s.frequency], 0);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
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
                  {FREQUENCY_LABEL[s.frequency]}
                  {s.status === "at_risk" ? " · At risk" : ""}
                </Text>
                {s.frequency === "annual" && s.averageAmount < 0 && <AmortizeChip stream={s} />}
              </View>
              <MoneyText cents={s.averageAmount} className="text-text" mask={false} style={{ fontSize: rf(14.5) }} />
              <Pressable onPress={() => confirmRemove(s)} hitSlop={10} className="ml-3">
                <Trash2 size={16} color={colors["text-3"]} />
              </Pressable>
            </View>
          ))}
          {streams.length === 0 && <Text className="font-ui text-text-3 py-4" style={{ fontSize: rf(14) }}>No subscriptions detected yet.</Text>}
        </Card>
      )}
    </ScrollView>
    </View>
  );
}
