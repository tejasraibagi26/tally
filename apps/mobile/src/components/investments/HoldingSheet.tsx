import { View, Text, ScrollView } from "react-native";
import { formatCents, formatPercent } from "@tally/core/money";
import type { Position } from "@tally/core/investments";
import { Sheet } from "@/components/ui/Sheet";
import { MoneyText } from "@/components/ui/MoneyText";
import { ActivityItem, Ticker, formatQuantity, shortDate } from "@/components/investments/parts";
import type { HoldingRow, InvestmentTransactionRow } from "@/lib/queries/investments";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/** One position across accounts: value and gain, cost per share, split by account, and its activity. */
export function HoldingSheet({
  position: p,
  holding,
  activity,
  onClose,
}: {
  position: Position | null;
  holding: HoldingRow | null;
  activity: InvestmentTransactionRow[];
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  if (!p) return null;
  const avgCost = p.costBasis != null && p.quantity > 0 ? p.costBasis / p.quantity : null;
  const gainColor = p.gain && p.gain.amount < 0 ? colors.negative : colors.positive;
  const sub = [
    p.isCashEquivalent ? "Cash" : p.assetType === "etf" ? "ETF" : p.assetType.charAt(0).toUpperCase() + p.assetType.slice(1),
    p.originalCurrencies.join(", "),
    holding?.priceAsOf && `price as of ${shortDate(holding.priceAsOf)}`,
  ]
    .filter(Boolean)
    .join(" · ");

  const rows: [string, string][] = p.isCashEquivalent
    ? []
    : [
        ["Quantity", `${formatQuantity(p.quantity)} shares`],
        ["Price", holding?.institutionPrice != null ? formatCents(holding.institutionPrice) : "—"],
        ["Average cost", avgCost != null ? `${formatCents(Math.round(avgCost))} / share` : "Not reported"],
        ["Cost basis", p.costBasis != null ? formatCents(p.costBasis) : "Not reported"],
        ["Weight", `${formatPercent(p.weight)} of portfolio`],
      ];

  return (
    <Sheet visible onClose={onClose} maxHeight="85%">
      <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-1 pb-4 gap-4">
          <View className="flex-row items-center gap-3">
            <Ticker ticker={p.ticker} isCash={p.isCashEquivalent} size={40} />
            <View className="flex-1 gap-0.5">
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(17) }} numberOfLines={1}>{p.securityName ?? p.ticker ?? "Unknown security"}</Text>
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>{sub}</Text>
            </View>
          </View>
          <View className="flex-row items-end justify-between">
            <View className="gap-1">
              <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>Value</Text>
              <MoneyText cents={p.value} mask={false} className="font-display text-text" style={{ fontSize: rf(30) }} />
            </View>
            {p.gain && (
              <Text className="font-ui-semibold" style={{ color: gainColor, fontSize: rf(15), fontVariant: ["tabular-nums"] }}>
                {formatCents(p.gain.amount, { signed: true })} · {p.gain.amount < 0 ? "−" : "+"}
                {formatPercent(Math.abs(p.gain.pct))}
              </Text>
            )}
          </View>
          {rows.length > 0 && (
            <View className="rounded-control bg-sunken px-4 py-3 gap-2">
              {rows.map(([k, v]) => (
                <View key={k} className="flex-row justify-between gap-3">
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(13) }}>{k}</Text>
                  <Text className="font-ui-medium text-text" style={{ fontSize: rf(13), fontVariant: ["tabular-nums"] }}>{v}</Text>
                </View>
              ))}
            </View>
          )}
          <View>
            <Text className="font-ui-semibold text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>By account</Text>
            {p.lots.map((l, i) => (
              <View key={l.accountId} className="flex-row items-center justify-between py-2.5" style={i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : undefined}>
                <View className="gap-0.5 flex-1 pr-3">
                  <Text className="font-ui text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{l.accountName}</Text>
                  {!p.isCashEquivalent && <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{formatQuantity(l.quantity)} sh</Text>}
                </View>
                <View className="items-end gap-0.5">
                  <MoneyText cents={l.value} mask={false} className="font-ui-medium text-text" style={{ fontSize: rf(14) }} />
                  {l.gain && (
                    <Text className="font-ui" style={{ fontSize: rf(11.5), color: l.gain.amount < 0 ? colors.negative : colors.positive }}>
                      {l.gain.amount < 0 ? "−" : "+"}
                      {formatPercent(Math.abs(l.gain.pct))}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
        <Text className="font-ui-semibold text-text-3 px-5" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>Activity</Text>
        {activity.length === 0 ? (
          <Text className="font-ui text-text-3 px-5 py-3" style={{ fontSize: rf(13) }}>No recent activity for this holding.</Text>
        ) : (
          activity.slice(0, 10).map((tx, i) => <ActivityItem key={tx.id} tx={tx} showTopBorder={i > 0} />)
        )}
      </ScrollView>
    </Sheet>
  );
}
