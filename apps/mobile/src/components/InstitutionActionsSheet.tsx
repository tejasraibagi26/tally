import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert } from "react-native";
import { RefreshCw, KeyRound, Unplug } from "lucide-react-native";
import { Sheet } from "@/components/ui/Sheet";
import { useRefreshItemBalances, useRevokeItem } from "@/lib/queries/plaid";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Mobile port of components/plaid/ItemActionsMenu.tsx's "⋯" dropdown — a
 * bare icon button (previously just KeyRound, standing in for "manage
 * access" alone) didn't read as tappable on mobile, and refresh/revoke had
 * no mobile equivalent at all. Same three actions, bottom-sheet shell
 * instead of a desktop dropdown (mobile's established picker/menu pattern —
 * see SimplePickerSheet.tsx, CategoryPickerSheet.tsx).
 */
export function InstitutionActionsSheet({
  visible,
  onClose,
  itemId,
  institutionName,
  onManageAccess,
}: {
  visible: boolean;
  onClose: () => void;
  itemId: string;
  institutionName: string;
  onManageAccess: () => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const refreshBalances = useRefreshItemBalances(itemId);
  const revoke = useRevokeItem(itemId);
  const [revoking, setRevoking] = useState(false);

  function handleRefresh() {
    onClose();
    refreshBalances.mutate();
  }

  function handleManageAccess() {
    onClose();
    onManageAccess();
  }

  function confirmRevoke() {
    onClose();
    Alert.alert(
      `Revoke ${institutionName}?`,
      "This disconnects it from Plaid and permanently deletes every account under it, along with all of their transaction history, balances, and holdings. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke connection",
          style: "destructive",
          onPress: () => {
            setRevoking(true);
            revoke.mutate(undefined, { onSettled: () => setRevoking(false) });
          },
        },
      ],
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="40%">
      <View className="px-5 pt-1 pb-2">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }} numberOfLines={1}>
          {institutionName}
        </Text>
      </View>
      <Pressable onPress={handleRefresh} disabled={refreshBalances.isPending} className="flex-row items-center gap-3 px-5 py-3.5">
        {refreshBalances.isPending ? <ActivityIndicator size="small" color={colors["text-2"]} /> : <RefreshCw size={17} color={colors["text-2"]} strokeWidth={1.9} />}
        <Text className="font-ui text-text" style={{ fontSize: rf(15) }}>Refresh balances</Text>
      </Pressable>
      <Pressable onPress={handleManageAccess} className="flex-row items-center gap-3 px-5 py-3.5">
        <KeyRound size={17} color={colors["text-2"]} strokeWidth={1.9} />
        <Text className="font-ui text-text" style={{ fontSize: rf(15) }}>Manage access</Text>
      </Pressable>
      <Pressable onPress={confirmRevoke} disabled={revoking} className="flex-row items-center gap-3 px-5 py-3.5">
        {revoking ? <ActivityIndicator size="small" color={colors.negative} /> : <Unplug size={17} color={colors.negative} strokeWidth={1.9} />}
        <Text className="font-ui text-negative" style={{ fontSize: rf(15) }}>Revoke connection</Text>
      </Pressable>
    </Sheet>
  );
}
