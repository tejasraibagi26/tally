import { View, Text, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { StatusChip } from "@/components/ui/StatusChip";
import { useAccounts, type Institution, type AccountRow } from "@/lib/queries/accounts";

// MOBILE_DESIGN.md §5.5 -- grouped by institution, broken connections get a
// critical badge + full-width Reconnect button. Native Plaid Link (add /
// reconnect) is Phase E -- the button here is a placeholder until that lands.
function InstitutionCard({ institution }: { institution: Institution }) {
  const initial = (institution.institutionName ?? "?").charAt(0).toUpperCase();
  const broken = institution.badge === "critical";

  return (
    <Card className="overflow-hidden">
      <View className="flex-row items-center justify-between px-5 pt-[18px] pb-4">
        <View className="flex-row items-center gap-3">
          <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: broken ? "#F6E7E4" : "#E6EFEA" }}>
            <Text className="font-ui-semibold text-[13px]" style={{ color: broken ? "#B23A2C" : "#14513F" }}>
              {initial}
            </Text>
          </View>
          <View>
            <Text className="font-ui-semibold text-[15px] text-text">{institution.institutionName ?? "Unknown"}</Text>
            <Text className="font-ui text-[12px] text-text-2">{relativeTime(institution.lastSyncedAt)}</Text>
          </View>
        </View>
        <StatusChip status={institution.badge} />
      </View>

      {institution.accounts.map((a, i) => (
        <AccountLine key={a.id} account={a} showTopBorder={i > 0} />
      ))}

      {broken && (
        <View className="px-5 pb-5 pt-1">
          <Pressable className="h-12 rounded-full items-center justify-center bg-brand active:opacity-90">
            <Text className="font-ui-semibold text-[14.5px] text-on-brand">Reconnect</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

function AccountLine({ account, showTopBorder }: { account: AccountRow; showTopBorder: boolean }) {
  return (
    <View
      className="flex-row items-center justify-between px-5 py-3.5"
      style={showTopBorder ? { borderTopWidth: 1, borderTopColor: "rgba(228,225,217,0.55)" } : undefined}
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
  const { data, isLoading, refetch, isRefetching } = useAccounts();

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 28 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#14513F" />}
    >
      <View className="px-5 pb-4">
        <Text className="font-ui-semibold text-[24px] text-text" style={{ letterSpacing: -0.3 }}>
          Accounts
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <View className="gap-5 px-5">
          {data?.institutions.map((inst) => (
            <InstitutionCard key={inst.id} institution={inst} />
          ))}
          {data && data.institutions.length === 0 && <Text className="font-ui text-[14px] text-text-3">No accounts connected yet.</Text>}
        </View>
      )}
    </ScrollView>
  );
}
