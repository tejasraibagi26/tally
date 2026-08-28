import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, RefreshCw } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAccounts, type Institution, type AccountRow } from "@/lib/queries/accounts";
import { usePlaidLink } from "@/lib/usePlaidLink";
import { useSync } from "@/lib/queries/plaid";
import { useThemeColors } from "@/theme/useThemeColors";
import { hairline } from "@/theme/colors";

// MOBILE_DESIGN.md §5.5 -- grouped by institution, broken connections get a
// critical badge + full-width Reconnect button, both wired to native Plaid
// Link (Phase 5). See usePlaidLink.ts for the OAuth-redirect caveat.
function InstitutionCard({ institution, onReconnect, reconnecting }: { institution: Institution; onReconnect: () => void; reconnecting: boolean }) {
  const colors = useThemeColors();
  const initial = (institution.institutionName ?? "?").charAt(0).toUpperCase();
  const broken = institution.badge === "critical";

  return (
    <Card className="overflow-hidden">
      <View className="flex-row items-center justify-between px-5 pt-[18px] pb-4">
        <View className="flex-row items-center gap-3">
          <View className={`w-8 h-8 rounded-full items-center justify-center ${broken ? "bg-negative-subtle" : "bg-brand-subtle"}`}>
            <Text className={`font-ui-semibold text-[13px] ${broken ? "text-negative" : "text-brand"}`}>{initial}</Text>
          </View>
          <View>
            <Text className="font-ui-semibold text-[15px] text-text">{institution.institutionName ?? "Unknown"}</Text>
            <Text className="font-ui text-[12px] text-text-2">{relativeTime(institution.lastSyncedAt)}</Text>
          </View>
        </View>
        <StatusChip status={institution.badge} />
      </View>

      {institution.accounts.map((a, i) => (
        <AccountLine key={a.id} account={a} showTopBorder={i > 0} colors={colors} />
      ))}

      {broken && (
        <View className="px-5 pb-5 pt-1">
          <Pressable onPress={onReconnect} disabled={reconnecting} className="h-12 rounded-full items-center justify-center bg-brand active:opacity-90 disabled:opacity-50">
            {reconnecting ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-ui-semibold text-[14.5px] text-on-brand">Reconnect</Text>}
          </Pressable>
        </View>
      )}
    </Card>
  );
}

function AccountLine({ account, showTopBorder, colors }: { account: AccountRow; showTopBorder: boolean; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View
      className="flex-row items-center justify-between px-5 py-3.5"
      style={showTopBorder ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}
    >
      <View className="gap-0.5">
        <Text className="font-ui-medium text-[14.5px] text-text">{account.name}</Text>
        {account.mask && (
          <Text className="text-[12px] text-text-2" style={{ fontFamily: "JetBrainsMono" }}>
            ····{account.mask}
          </Text>
        )}
      </View>
      <MoneyText cents={account.currentBalance ?? 0} className="text-[15px] text-text" />
    </View>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never synced";
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "Updated just now";
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
}

export default function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { data, isLoading, refetch, isRefetching } = useAccounts();
  const { openLink, isLinking, error } = usePlaidLink();
  const sync = useSync();

  async function handleSync() {
    try {
      const res = await sync.mutateAsync(["balances"]);
      const failed = res.results.filter((r) => r.failures.length > 0);
      if (failed.length > 0) {
        Alert.alert(
          "Some accounts didn't sync",
          failed.map((f) => `${f.institutionName ?? "An account"}: ${f.failures.map((x) => x.label).join(", ")}`).join("\n"),
        );
      }
    } catch {
      Alert.alert("Sync failed", "Please try again in a moment.");
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brand} />}
    >
      <View className="flex-row items-center justify-between px-5 pb-4">
        <Text className="font-ui-semibold text-[24px] text-text" style={{ letterSpacing: -0.3 }}>
          Accounts
        </Text>
        <View className="flex-row items-center gap-2">
          {data && data.institutions.length > 0 && (
            <Pressable
              onPress={handleSync}
              disabled={sync.isPending}
              className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 disabled:opacity-50 bg-brand-subtle"
            >
              {sync.isPending ? <ActivityIndicator size="small" color={colors.brand} /> : <RefreshCw size={14} color={colors.brand} strokeWidth={2} />}
              <Text className="font-ui-semibold text-[13px] text-brand">Sync</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => openLink("create")}
            disabled={isLinking}
            className="flex-row items-center gap-1.5 rounded-full px-3.5 py-2 disabled:opacity-50 bg-brand-subtle"
          >
            {isLinking ? <ActivityIndicator size="small" color={colors.brand} /> : <Plus size={15} color={colors.brand} strokeWidth={2} />}
            <Text className="font-ui-semibold text-[13px] text-brand">Add</Text>
          </Pressable>
        </View>
      </View>

      {error && (
        <View className="mx-5 mb-4 rounded-control px-4 py-3 bg-negative-subtle">
          <Text className="font-ui text-[13.5px] text-negative">{error}</Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <View className="gap-5 px-5">
          {data?.institutions.map((inst) => (
            <InstitutionCard key={inst.id} institution={inst} onReconnect={() => openLink("update", inst.id)} reconnecting={isLinking} />
          ))}
          {data && data.institutions.length === 0 && <Text className="font-ui text-[14px] text-text-3">No accounts connected yet.</Text>}
        </View>
      )}
    </ScrollView>
  );
}
