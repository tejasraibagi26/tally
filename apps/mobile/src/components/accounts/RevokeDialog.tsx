import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { AlertTriangle, Unplug } from "lucide-react-native";
import { TallyDialog, DialogError } from "@/components/ui/TallyDialog";
import { useRevokeItem } from "@/lib/queries/plaid";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/** Rows listed before collapsing the rest into "and N more". */
const LIST_MAX = 6;

interface RevokeTarget {
  id: string;
  institutionName: string | null;
  accounts: { id: string; name: string; nickname?: string | null; mask: string | null }[];
}

/**
 * Disconnecting a bank: a TallyDialog that says what stops (syncing, these
 * accounts' balances) and what stays (their history), keeps the label on its
 * button while it works, and shows a failure in place instead of closing.
 * Nothing is deleted -- reconnecting the same bank picks the history back up
 * (apps/web/lib/reattach.ts). `confirmRevoke(target)` opens it; render
 * `revokeDialog`. `onRevoked` fires after it succeeds (for a toast).
 */
export function useRevokeDialog(onRevoked?: (institutionName: string) => void) {
  const colors = useThemeColors();
  const rf = useRF();
  const revoke = useRevokeItem();
  const [target, setTarget] = useState<RevokeTarget | null>(null);
  const [failed, setFailed] = useState(false);

  const confirmRevoke = useCallback((t: RevokeTarget) => {
    setFailed(false);
    setTarget(t);
  }, []);

  const name = target?.institutionName ?? "this bank";
  const busy = revoke.isPending;

  function run() {
    if (!target) return;
    setFailed(false);
    revoke.mutate(target.id, {
      onSuccess: () => {
        setTarget(null);
        onRevoked?.(name);
      },
      onError: () => setFailed(true),
    });
  }

  const revokeDialog = (
    <TallyDialog
      visible={target !== null}
      onClose={() => setTarget(null)}
      dismissible={!busy}
      tone="negative"
      icon={<Unplug size={20} color={colors.negative} strokeWidth={1.75} />}
      title={`Disconnect ${name}?`}
      subtitle="Your history stays"
      actions={[
        { label: failed ? "Try again" : "Disconnect", onPress: run, variant: "danger", loading: busy },
        { label: "Cancel", onPress: () => setTarget(null), variant: "secondary", disabled: busy },
      ]}
    >
      <Text className="font-ui text-text-2" style={{ fontSize: rf(14), lineHeight: rf(20) }}>
        Tally removes its access to {name} and stops syncing. Past transactions stay and keep counting in spending and budgets. Balances leave your net worth until you reconnect.
      </Text>
      {failed ? (
        <DialogError icon={<AlertTriangle size={16} color={colors.negative} strokeWidth={1.75} style={{ marginTop: 1 }} />}>
          {`Couldn't disconnect ${name}. Check your connection and try again.`}
        </DialogError>
      ) : (
        target &&
        target.accounts.length > 0 && (
          <View className="rounded-[10px] bg-surface-2 px-3 py-2.5" style={{ borderWidth: 1, borderColor: colors.border, gap: 6 }}>
            <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5), letterSpacing: 0.6, textTransform: "uppercase" }}>
              Stops updating
            </Text>
            {target.accounts.slice(0, LIST_MAX).map((a) => (
              <View key={a.id} className="flex-row justify-between gap-3">
                <Text className="font-ui text-text flex-1" style={{ fontSize: rf(13) }} numberOfLines={1}>
                  {a.nickname ?? a.name}
                </Text>
                {a.mask && <Text className="font-mono text-text-3" style={{ fontSize: rf(12) }}>····{a.mask}</Text>}
              </View>
            ))}
            {target.accounts.length > LIST_MAX && (
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>and {target.accounts.length - LIST_MAX} more</Text>
            )}
          </View>
        )
      )}
    </TallyDialog>
  );

  return { confirmRevoke, revokeDialog };
}
