import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { UpcomingRows, sortBills } from "@/components/overview/UpcomingRows";
import { UpcomingBillSheet } from "@/components/overview/UpcomingBillSheet";
import type { UpcomingBill } from "@/lib/queries/overview";
import { useRF } from "@/theme/responsiveFont";

const SHOWN = 3;

/**
 * The next few bills on Overview; "View all" always opens the full Upcoming
 * screen (grouped, card payments included, a link to Subscriptions), even
 * with three or fewer bills, since that screen is the only way to reach it.
 * A bill Tally guessed from past charges opens a sheet where the person can
 * say it won't recur.
 */
export function UpcomingList({ bills, onDismissed }: { bills: UpcomingBill[]; onDismissed?: (bill: UpcomingBill) => void }) {
  const router = useRouter();
  const rf = useRF();
  const [selected, setSelected] = useState<UpcomingBill | null>(null);
  if (bills.length === 0) return null;
  const sorted = sortBills(bills);

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Upcoming</Text>
        <Pressable onPress={() => router.push("/upcoming")} hitSlop={8} accessibilityRole="link">
          <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13.5) }}>View all</Text>
        </Pressable>
      </View>
      <UpcomingRows bills={sorted.slice(0, SHOWN)} onSelect={setSelected} />
      <UpcomingBillSheet bill={selected} onClose={() => setSelected(null)} onDismissed={onDismissed} />
    </View>
  );
}
