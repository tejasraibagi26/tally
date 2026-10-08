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
 * Revoking a connection: a TallyDialog that lists the exact accounts being
 * deleted, keeps the label on its button while it works, and shows a failure
 * in place instead of closing. `confirmRevoke(target)` opens it; render
 * `revokeDialog`. `onRevoked` fires after a successful delete (for a toast).
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
      title={`Revoke ${name}?`}
      subtitle="This can't be undone"
      actions={[
        { label: failed ? "Try again" : "Revoke connection", onPress: run, variant: "danger", loading: busy },
        { label: "Cancel", onPress: () => setTarget(null), variant: "secondary", disabled: busy },
      ]}
    >
      <Text className="font-ui text-text-2" style={{ fontSize: rf(14), lineHeight: rf(20) }}>
        Tally disconnects from {name} through Plaid and deletes {target && target.accounts.length > 0 ? "these accounts" : "every account under it"} with all their history.
      </Text>
      {failed ? (
        <DialogError icon={<AlertTriangle size={16} color={colors.negative} strokeWidth={1.75} style={{ marginTop: 1 }} />}>
          {`Couldn't revoke ${name}. Nothing was deleted. Check your connection and try again.`}
        </DialogError>
      ) : (
        target &&
        target.accounts.length > 0 && (
          <View className="rounded-[10px] bg-surface-2 px-3 py-2.5" style={{ borderWidth: 1, borderColor: colors.border, gap: 6 }}>
            <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5), letterSpacing: 0.6, textTransform: "uppercase" }}>
              Accounts to delete
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
