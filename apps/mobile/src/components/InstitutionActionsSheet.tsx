import { View, Text, Pressable } from "react-native";
import { RefreshCw, KeyRound, Unplug } from "lucide-react-native";
import { Sheet } from "@/components/ui/Sheet";
import { useRefreshItemBalances } from "@/lib/queries/plaid";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { BusyIcon } from "@/components/ui/BusyIcon";

/**
 * Mobile port of components/plaid/ItemActionsMenu.tsx's "⋯" dropdown — a
 * bare icon button (previously just KeyRound, standing in for "manage
 * access" alone) didn't read as tappable on mobile, and refresh/revoke had
 * no mobile equivalent at all. Same three actions, bottom-sheet shell
 * instead of a desktop dropdown (mobile's established picker/menu pattern —
 * see SimplePickerSheet.tsx, CategoryPickerSheet.tsx). Opens with a status
 * block (state, exact last-sync time, account count) so the reason a card
 * looks the way it does is one tap away.
 */
export function InstitutionActionsSheet({
  visible,
  onClose,
  itemId,
  institutionName,
  onManageAccess,
  status,
  lastSyncedAt,
  accountCount,
  onRevoke,
}: {
  visible: boolean;
  onClose: () => void;
  itemId: string;
  institutionName: string;
  onManageAccess: () => void;
  /** The card's own status (lib/connectionState.ts), repeated with its exact sync time. */
  status?: { label: string; color: string };
  lastSyncedAt?: string | null;
  accountCount?: number;
  /** Opens the disconnect dialog (components/accounts/RevokeDialog.tsx) once this sheet has closed. */
  onRevoke: () => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const refreshBalances = useRefreshItemBalances();

  function handleRefresh() {
    onClose();
    refreshBalances.mutate(itemId);
  }

  function handleManageAccess() {
    onClose();
    onManageAccess();
  }

  function confirmRevoke() {
    onClose();
    // Let this sheet finish closing first: iOS won't present the dialog's
    // Modal on top of one that's animating out.
    setTimeout(onRevoke, 350);
  }

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="75%">
      <View className="px-5 pt-1 pb-2">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(16) }} numberOfLines={1}>
          {institutionName}
        </Text>
      </View>
      {status && (
        <View className="mx-5 mb-2 rounded-control bg-sunken px-3.5 py-3 gap-2">
          <MetaRow label="Status" value={status.label} valueColor={status.color} />
          <MetaRow label="Last synced" value={lastSyncedAt ? exactTime(lastSyncedAt) : "Never"} />
          {accountCount != null && <MetaRow label="Accounts" value={String(accountCount)} />}
        </View>
      )}
      <Pressable onPress={handleRefresh} disabled={refreshBalances.isPending} className="flex-row items-center gap-3 px-5 py-3.5">
        <BusyIcon busy={refreshBalances.isPending} color={colors["text-2"]!} size={17}>
          <RefreshCw size={17} color={colors["text-2"]} strokeWidth={1.9} />
        </BusyIcon>
        <View className="gap-0.5">
          <Text className="font-ui text-text" style={{ fontSize: rf(15) }}>Refresh balances</Text>
          <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>Fetch the latest balances now</Text>
        </View>
      </Pressable>
      <Pressable onPress={handleManageAccess} className="flex-row items-center gap-3 px-5 py-3.5">
        <KeyRound size={17} color={colors["text-2"]} strokeWidth={1.9} />
        <View className="gap-0.5">
          <Text className="font-ui text-text" style={{ fontSize: rf(15) }}>Manage access</Text>
          <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>Sign in again or change which accounts Tally sees</Text>
        </View>
      </Pressable>
      <Pressable onPress={confirmRevoke} className="flex-row items-center gap-3 px-5 py-3.5">
        <Unplug size={17} color={colors.negative} strokeWidth={1.9} />
        <View className="gap-0.5">
          <Text className="font-ui text-negative" style={{ fontSize: rf(15) }}>Disconnect</Text>
          <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>Stop syncing. Its history stays</Text>
        </View>
      </Pressable>
    </Sheet>
  );
}

function exactTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Today, ${time}` : `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}

function MetaRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const rf = useRF();
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>{label}</Text>
      <Text className="font-ui-medium text-text" // Only set color when given: an explicit `color: undefined` in style
      // overrides the text-text class and renders black.
      style={[{ fontSize: rf(12.5), flexShrink: 1, textAlign: "right" }, valueColor ? { color: valueColor } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}
