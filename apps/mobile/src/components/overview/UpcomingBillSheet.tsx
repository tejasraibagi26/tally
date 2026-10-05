import { useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Sheet } from "@/components/ui/Sheet";
import { MoneyText } from "@/components/ui/MoneyText";
import { useDeleteSubscription } from "@/lib/queries/subscriptions";
import type { UpcomingBill } from "@/lib/queries/overview";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Tally lists a bill here because it guessed the pattern from past charges.
 * This lets the person say a guess is wrong -- a one-off, a bonus -- by
 * dismissing the stream behind it: it leaves Upcoming and Subscriptions and
 * the detector never brings it back (DELETE /api/recurring-streams/[id]).
 */
export function UpcomingBillSheet({ bill, onClose }: { bill: UpcomingBill | null; onClose: () => void }) {
  const colors = useThemeColors();
  const rf = useRF();
  const remove = useDeleteSubscription();
  const [error, setError] = useState(false);
  // Keep the last bill while the sheet slides away so its content doesn't blank mid-animation.
  const shown = useRef<UpcomingBill | null>(bill);
  if (bill) shown.current = bill;
  const b = shown.current;

  function close() {
    setError(false);
    onClose();
  }

  function dismiss() {
    if (!b?.streamId) return;
    setError(false);
    remove.mutate(b.streamId, { onSuccess: close, onError: () => setError(true) });
  }

  return (
    <Sheet visible={bill != null} onClose={close} maxHeight="60%">
      {b && (
        <View className="px-5 pt-1 pb-4 gap-4">
          <View className="gap-1">
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(17) }} numberOfLines={2}>{b.label}</Text>
            <MoneyText cents={b.amount} mask={false} className="text-text-2" style={{ fontSize: rf(14) }} />
          </View>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(14), lineHeight: rf(20) }}>
            Tally expects this because of how often it has been paid before. If it won't come again, like a one-off or a bonus, tell Tally and it will stop listing it. It also leaves your Subscriptions list.
          </Text>
          {error && <Text className="font-ui text-negative" style={{ fontSize: rf(13) }}>Couldn't update this. Try again.</Text>}
          <View className="gap-2 pt-1">
            <Pressable
              onPress={dismiss}
              disabled={remove.isPending}
              className="h-12 rounded-full items-center justify-center bg-brand active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="This won't recur"
            >
              {remove.isPending ? (
                <ActivityIndicator color={colors["on-brand"]} />
              ) : (
                <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14.5) }}>This won't recur</Text>
              )}
            </Pressable>
            <Pressable onPress={close} disabled={remove.isPending} className="h-11 items-center justify-center" accessibilityRole="button" accessibilityLabel="Keep it">
              <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(14) }}>Keep it</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Sheet>
  );
}
