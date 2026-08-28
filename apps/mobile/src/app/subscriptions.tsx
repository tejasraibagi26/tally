import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { useSubscriptions, type RecurringStream } from "@/lib/queries/subscriptions";
import { useThemeColors } from "@/theme/useThemeColors";
import { hairline } from "@/theme/colors";

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
  const { data, isLoading } = useSubscriptions();
  const streams = (data?.streams ?? []).filter((s) => s.status !== "cancelled");

  const monthlyTotal = streams.reduce((sum, s) => sum + s.averageAmount * MONTHLY_MULTIPLIER[s.frequency], 0);

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
      <Card className="p-5 flex-row justify-between">
        <View>
          <Text className="font-ui text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
            Monthly
          </Text>
          <MoneyText cents={Math.round(monthlyTotal)} className="font-display text-[24px] text-text" />
        </View>
        <View>
          <Text className="font-ui text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
            Annualized
          </Text>
          <MoneyText cents={Math.round(monthlyTotal * 12)} className="font-display text-[24px] text-text" />
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
                <Text className="font-ui-semibold text-[15px] text-text" numberOfLines={1}>
                  {s.description ?? s.merchantKey}
                </Text>
                <Text className="font-ui text-[12.5px] text-text-2">
                  {FREQUENCY_LABEL[s.frequency]}
                  {s.status === "at_risk" ? " · At risk" : ""}
                </Text>
              </View>
              <MoneyText cents={s.averageAmount} className="text-[14.5px] text-text" />
            </View>
          ))}
          {streams.length === 0 && <Text className="font-ui text-[14px] text-text-3 py-4">No subscriptions detected yet.</Text>}
        </Card>
      )}
    </ScrollView>
  );
}
