import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { TrendingUp } from "lucide-react-native";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { useHoldings, useInvestmentTransactions } from "@/lib/queries/investments";
import { chartSeries, hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useColorScheme } from "nativewind";

function formatQuantity(q: string): string {
  const n = parseFloat(q);
  if (!Number.isFinite(n)) return q;
  return Number.isInteger(n) ? n.toString() : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

// MOBILE_DESIGN.md-style adaptation of apps/web/app/(app)/investments/page.tsx:
// portfolio value/gain/return stat row, allocation bar, holdings grouped by
// account as card lists (web's wide table collapses to stacked rows), recent
// activity. Historical-return chart and multi-currency FX conversion on the
// activity feed are left as web-only for now.
export default function InvestmentsScreen() {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const { data, isLoading } = useHoldings();
  const { data: activityData } = useInvestmentTransactions();

  if (isLoading || !data) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (data.holdings.length === 0) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center px-8 gap-3">
        <TrendingUp size={28} color={colors["text-3"]} strokeWidth={1.5} />
        <Text className="font-ui-semibold text-[16px] text-text text-center">Nothing invested here yet</Text>
        <Text className="font-ui text-[13.5px] text-text-2 text-center">
          Connect a brokerage account from the Accounts tab. Holdings usually appear within a minute.
        </Text>
      </View>
    );
  }

  const holdingsByAccount = new Map<string, typeof data.holdings>();
  for (const h of data.holdings) {
    holdingsByAccount.set(h.accountId, [...(holdingsByAccount.get(h.accountId) ?? []), h]);
  }

  const activity = activityData?.transactions.slice(0, 10) ?? [];

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
      <Card className="p-5 gap-5">
        <View className="gap-1">
          <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
            Portfolio value
          </Text>
          <MoneyText cents={data.value} className="font-display text-[32px] text-text" />
        </View>
        <View className="flex-row gap-6">
          <View className="flex-1 gap-1">
            <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
              Unrealized gain
            </Text>
            {data.unrealizedGain.hasCostBasis ? (
              <MoneyText
                cents={data.unrealizedGain.gain}
                signed
                className="font-ui-semibold text-[16px]"
                style={{ color: data.unrealizedGain.gain < 0 ? colors.negative : colors.positive }}
              />
            ) : (
              <Text className="font-ui text-[13px] text-text-3">No cost basis</Text>
            )}
          </View>
          <View className="flex-1 gap-1">
            <Text className="font-ui-medium text-[11px] tracking-wide text-text-2" style={{ textTransform: "uppercase" }}>
              Simple return
            </Text>
            {data.simpleReturn.hasHistory ? (
              <MoneyText
                cents={data.simpleReturn.value}
                signed
                className="font-ui-semibold text-[16px]"
                style={{ color: data.simpleReturn.value < 0 ? colors.negative : colors.positive }}
              />
            ) : (
              <Text className="font-ui text-[13px] text-text-3">Building history…</Text>
            )}
          </View>
        </View>
      </Card>

      <View className="gap-3">
        <Text className="font-ui-semibold text-[13px] text-text-2" style={{ textTransform: "uppercase" }}>
          Allocation
        </Text>
        <Card className="p-5 gap-4">
          <View className="flex-row h-3 rounded-full overflow-hidden bg-sunken">
            {data.allocation.map((slice, i) => (
              <View key={slice.label} style={{ width: `${slice.pct * 100}%`, backgroundColor: series[i % 8] }} />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-x-5 gap-y-2.5">
            {data.allocation.map((slice, i) => (
              <View key={slice.label} className="flex-row items-center gap-2">
                <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: series[i % 8] }} />
                <Text className="font-ui text-[13px] text-text">{slice.label}</Text>
                <Text className="font-ui text-[13px] text-text-3">{Math.round(slice.pct * 100)}%</Text>
              </View>
            ))}
          </View>
        </Card>
      </View>

      {[...holdingsByAccount.entries()].map(([accountId, accountHoldings]) => (
        <View key={accountId} className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-ui-semibold text-[15px] text-text">{accountHoldings[0]?.accountName ?? "Account"}</Text>
            <MoneyText cents={accountHoldings.reduce((s, h) => s + h.institutionValue, 0)} className="font-ui-medium text-[14px] text-text-2" />
          </View>
          <Card className="px-5">
            {accountHoldings.map((h, i, arr) => (
              <View
                key={h.securityId}
                className="flex-row items-center justify-between py-4"
                style={i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
              >
                <View className="gap-0.5 flex-1 pr-3">
                  <Text className="font-ui-semibold text-[15px] text-text" numberOfLines={1}>
                    {h.securityName ?? "Unknown security"}
                  </Text>
                  <Text className="font-ui text-[12.5px] text-text-2">
                    {h.ticker ?? "—"} · {formatQuantity(h.quantity)} sh
                  </Text>
                </View>
                <MoneyText cents={h.institutionValue} className="text-[15px] text-text" />
              </View>
            ))}
          </Card>
        </View>
      ))}

      {activity.length > 0 && (
        <View className="gap-3">
          <Text className="font-ui-semibold text-[13px] text-text-2" style={{ textTransform: "uppercase" }}>
            Recent activity
          </Text>
          <Card className="px-5">
            {activity.map((tx, i, arr) => (
              <View
                key={tx.id}
                className="flex-row items-center justify-between py-4"
                style={i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: hairline(colors) } : undefined}
              >
                <View className="gap-0.5 flex-1 pr-3">
                  <Text className="font-ui-medium text-[14.5px] text-text" numberOfLines={1}>
                    {tx.name ?? tx.securityName ?? "Transaction"}
                    {tx.ticker ? ` · ${tx.ticker}` : ""}
                  </Text>
                  <Text className="font-ui text-[12px] text-text-2">{tx.date}</Text>
                </View>
                <MoneyText cents={tx.amount} signed className="text-[14.5px]" style={{ color: tx.amount < 0 ? colors.positive : colors.text }} />
              </View>
            ))}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}
