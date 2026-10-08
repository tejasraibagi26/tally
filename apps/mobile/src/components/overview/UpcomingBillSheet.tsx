import { useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Sheet } from "@/components/ui/Sheet";
import { MoneyText } from "@/components/ui/MoneyText";
import { useDeleteSubscription } from "@/lib/queries/subscriptions";
import type { UpcomingBill } from "@/lib/queries/overview";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { PillButton, SheetError } from "@/components/ui/FormSheet";

/**
 * Tally lists a bill here because it guessed the pattern from past charges.
 * This lets the person say a guess is wrong -- a one-off, a bonus -- by
 * dismissing the stream behind it: it leaves Upcoming and Subscriptions and
 * the detector never brings it back (DELETE /api/recurring-streams/[id]).
 */
export function UpcomingBillSheet({
  bill,
  onClose,
  onDismissed,
}: {
  bill: UpcomingBill | null;
  onClose: () => void;
  /** Called once the bill is dismissed, so the screen can offer Undo. */
  onDismissed?: (bill: UpcomingBill) => void;
}) {
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
    const dismissed = b;
    remove.mutate(dismissed.streamId!, {
      onSuccess: () => {
        close();
        onDismissed?.(dismissed);
      },
      onError: () => setError(true),
    });
  }

  return (
    <Sheet visible={bill != null} onClose={close} maxHeight="60%">
      {b && (
        <View className="px-5 pt-1 pb-4 gap-4">
          <View className="gap-1">
            <Text className="font-ui-semibold text-text" style={{ fontSize: rf(17) }} numberOfLines={2}>{b.label}</Text>
            {b.amount != null && <MoneyText cents={b.amount} mask={false} className="text-text-2" style={{ fontSize: rf(14) }} />}
          </View>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(14), lineHeight: rf(20) }}>
            Tally expects this because of how often it has been paid before. If it won't come again, like a one-off or a bonus, tell Tally and it will stop listing it. It also leaves your Subscriptions list.
          </Text>
          {error && <SheetError>Couldn't update this. Check your connection and try again.</SheetError>}
          <View className="gap-2 pt-1">
            <PillButton label="This won't recur" onPress={dismiss} loading={remove.isPending} height={48} />
            <Pressable onPress={close} disabled={remove.isPending} className="h-11 items-center justify-center" accessibilityRole="button" accessibilityLabel="Keep it">
              <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(14) }}>Keep it</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Sheet>
  );
}
