import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoneyText } from "@/components/ui/MoneyText";
import { useTransaction } from "@/lib/queries/transactions";
import { amountColor } from "@/lib/amountColor";

// MOBILE_DESIGN.md §5.4 -- the web side panel's mobile equivalent. A full
// modal screen here for now; converting to a true bottom sheet is a
// follow-up (needs a sheet library decision -- @gorhom/bottom-sheet is the
// standard choice, deliberately not added speculatively).
export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: t, isLoading } = useTransaction(id);

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 12 }}>
      <Stack.Screen options={{ presentation: "modal" }} />
      <View className="flex-row items-center justify-between px-5 pb-4">
        <Text className="font-ui-semibold text-[18px] text-text">Transaction</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <X size={22} color="#524F47" />
        </Pressable>
      </View>

      {isLoading || !t ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <ScrollView className="px-5" contentContainerStyle={{ gap: 20, paddingBottom: 40 }}>
          <View className="gap-1.5">
            <MoneyText cents={t.amount} signed className="font-display text-[36px]" style={{ color: amountColor(t.amount) }} />
            <Text className="font-ui-semibold text-[16px] text-text">{t.merchantName ?? t.name}</Text>
            <Text className="font-ui text-[13.5px] text-text-2">
              {new Date(t.postedDate + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
            </Text>
          </View>

          <View className="gap-3 pt-2" style={{ borderTopWidth: 1, borderTopColor: "#E4E1D9" }}>
            <DetailRow label="Category" value={t.pfcDetailed ?? "Uncategorized"} />
            <DetailRow label="Status" value={t.isPending ? "Pending" : "Posted"} />
            {t.notes && <DetailRow label="Notes" value={t.notes} />}
          </View>

          {t.splits.length > 0 && (
            <View className="gap-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: "#E4E1D9" }}>
              <Text className="font-ui-semibold text-[13px] text-text-2" style={{ textTransform: "uppercase" }}>
                Split
              </Text>
              {t.splits.map((s, i) => (
                <View key={i} className="flex-row justify-between">
                  <Text className="font-ui text-[14px] text-text">{s.note ?? "Split"}</Text>
                  <MoneyText cents={s.amount} className="text-[14px] text-text" />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="font-ui text-[14px] text-text-2">{label}</Text>
      <Text className="font-ui text-[14px] text-text">{value}</Text>
    </View>
  );
}
