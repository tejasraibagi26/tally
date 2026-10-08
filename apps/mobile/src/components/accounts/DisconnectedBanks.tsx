import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Card } from "@/components/ui/Card";
import type { DisconnectedInstitution } from "@/lib/queries/accounts";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

function initials(name: string | null): string {
  const words = (name ?? "?").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Banks the user disconnected, below the live ones (mirrors web's
 * components/accounts/DisconnectedBanks.tsx). History kept, balances out of
 * the totals. Reconnect runs a normal "create" Link session; the server
 * recognises the bank and picks the history back up.
 */
export function DisconnectedBanks({ banks, onReconnect, connecting }: { banks: DisconnectedInstitution[]; onReconnect: () => void; connecting: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <View className="gap-2 mt-1">
      <Text className="font-ui-semibold text-text-3 px-1" style={{ fontSize: rf(11.5), letterSpacing: 0.6, textTransform: "uppercase" }} accessibilityRole="header">
        Disconnected · {banks.length}
      </Text>
      <Text className="font-ui text-text-2 px-1" style={{ fontSize: rf(12.5), lineHeight: rf(17) }}>
        Their transactions still count in spending and budgets. Balances stopped updating, so they're left out of the totals.
      </Text>
      <Card className="overflow-hidden">
        {banks.map((bank, i) => (
          <View key={bank.id} className="flex-row items-center gap-3 px-4 py-3.5" style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}>
            <View className="items-center justify-center rounded-[9px] bg-sunken" style={{ width: 34, height: 34 }}>
              <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(13) }}>{initials(bank.institutionName)}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-ui-medium text-text" style={{ fontSize: rf(14.5) }} numberOfLines={1}>{bank.institutionName ?? "Bank"}</Text>
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }} numberOfLines={1}>
                Disconnected {shortDate(bank.disconnectedAt)} · {bank.accounts.length} account{bank.accounts.length === 1 ? "" : "s"} kept
              </Text>
            </View>
            <Pressable
              onPress={onReconnect}
              disabled={connecting}
              accessibilityRole="button"
              accessibilityLabel={`Reconnect ${bank.institutionName ?? "this bank"}`}
              className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 bg-brand-subtle"
            >
              {connecting && <ActivityIndicator size="small" color={colors.brand} />}
              <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>Reconnect</Text>
            </Pressable>
          </View>
        ))}
      </Card>
    </View>
  );
}
