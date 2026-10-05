import { useState } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { groupUpcoming } from "@tally/core/overviewView";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { UpcomingRows } from "@/components/overview/UpcomingRows";
import { UpcomingBillSheet } from "@/components/overview/UpcomingBillSheet";
import { useOverview, type UpcomingBill } from "@/lib/queries/overview";
import { todayISO } from "@/lib/today";
import { useRF } from "@/theme/responsiveFont";

/**
 * Every bill in the next 30 days, card payments included -- where Overview's
 * Upcoming "View all" lands. Reads the same overview payload (it already
 * carries the whole window; Overview just shows three), grouped Overdue /
 * This week / Later.
 */
export default function UpcomingScreen() {
  const router = useRouter();
  const rf = useRF();
  const contentTop = useScreenContentTop();
  const overview = useOverview();
  const [selected, setSelected] = useState<UpcomingBill | null>(null);
  const groups = groupUpcoming(overview.data?.upcomingBills ?? [], todayISO());
  const sections: { title: string; bills: UpcomingBill[] }[] = [
    { title: "Overdue", bills: groups.overdue },
    { title: "This week", bills: groups.thisWeek },
    { title: "Later", bills: groups.later },
  ].filter((s) => s.bills.length > 0);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 20, paddingBottom: 40 }}>
        {overview.isLoading ? (
          <ActivityIndicator />
        ) : sections.length === 0 ? (
          <Text className="font-ui text-text-3 py-4" style={{ fontSize: rf(14) }}>Nothing due in the next 30 days.</Text>
        ) : (
          sections.map((s) => (
            <View key={s.title} className="gap-2.5">
              <Text className="font-ui-semibold text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.66, textTransform: "uppercase" }} accessibilityRole="header">
                {s.title}
              </Text>
              <UpcomingRows bills={s.bills} onSelect={setSelected} />
            </View>
          ))
        )}
        <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>
          Recurring charges are managed in{" "}
          <Text className="font-ui-semibold text-brand" onPress={() => router.push("/subscriptions")} accessibilityRole="link">
            Subscriptions
          </Text>
          .
        </Text>
      </ScrollView>
      <UpcomingBillSheet bill={selected} onClose={() => setSelected(null)} />
    </View>
  );
}
