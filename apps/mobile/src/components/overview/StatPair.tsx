import { View, Text, Pressable, PixelRatio, useWindowDimensions } from "react-native";
import { useRouter, type Href } from "expo-router";
import { creditHealth } from "@tally/core/overviewView";
import { formatCents, formatPercent } from "@tally/core/money";
import { MoneyText } from "@/components/ui/MoneyText";
import { usePrivacy } from "@/lib/PrivacyContext";
import type { UtilizationResult } from "@/lib/queries/liabilities";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Investments and Credit used in one card, a hairline between the two. One
 * figure alone fills the card; none renders nothing. Stacks to a column on
 * narrow screens or large text. Each side opens its own screen. Credit shows
 * the balance and limit behind the percentage (hidden with the privacy toggle,
 * since a card balance is an account balance) and says when a card without a
 * reported limit is left out of the ratio.
 */
export function StatPair({ investmentsCents, credit, highCards = 0 }: { investmentsCents: number | null; credit: UtilizationResult | null; highCards?: number }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const { width } = useWindowDimensions();
  const { hidden } = usePrivacy();
  const utilization = credit?.utilization ?? null;
  if (investmentsCents == null && utilization == null) return null;
  const stacked = width < 340 || PixelRatio.getFontScale() > 1.15;
  const both = investmentsCents != null && utilization != null;
  const health = utilization != null ? creditHealth(utilization) : null;
  const fill = health?.tone === "warning" ? colors.warning : colors.brand;
  const meter = utilization != null && (
    <View className="h-[5px] rounded-full bg-sunken overflow-hidden mt-0.5">
      <View style={{ width: `${Math.min(1, Math.max(0, utilization)) * 100}%`, height: "100%", backgroundColor: fill }} />
    </View>
  );
  const amounts = credit && !hidden ? `${formatCents(credit.totalBalance)} of ${formatCents(credit.totalLimit)} limit` : null;
  // A healthy total can hide one maxed card; say so. When the total is already High the note adds nothing.
  const highNote = health?.label === "Healthy" && highCards > 0 ? `${highCards} card${highCards === 1 ? " is" : "s are"} high` : null;
  const excluded = credit && credit.excludedCount > 0 ? `${credit.excludedCount} card${credit.excludedCount === 1 ? "" : "s"} without a limit not counted` : null;
  const divider = stacked ? { height: 1, marginHorizontal: 16 } : { width: 1, marginVertical: 16 };

  return (
    <View className={`rounded-card bg-surface overflow-hidden ${stacked ? "" : "flex-row"}`}>
      {investmentsCents != null && (
        <Pressable onPress={() => router.push("/investments")} className="flex-1 p-4 gap-1.5 active:opacity-80" accessibilityRole="button" accessibilityLabel="Investments">
          <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5) }}>Investments</Text>
          <MoneyText cents={investmentsCents} className="font-ui-semibold text-text" style={{ fontSize: rf(19) }} numberOfLines={1} adjustsFontSizeToFit />
          <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>Portfolio value</Text>
        </Pressable>
      )}
      {both && <View style={[{ backgroundColor: hairline(colors) }, divider]} />}
      {utilization != null && health && (
        <Pressable
          onPress={() => router.push("/cards" as Href)}
          className={`flex-1 p-4 active:opacity-80 ${both ? "gap-1.5" : "flex-row items-center justify-between gap-4"}`}
          accessibilityRole="button"
          accessibilityLabel={`Credit used ${formatPercent(utilization)}, ${health.label}${highNote ? `, ${highNote}` : ""}`}
        >
          {both ? (
            <>
              <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5) }}>Credit used</Text>
              <View className="flex-row items-baseline gap-1.5">
                <Text className="font-ui-semibold text-text" style={{ fontSize: rf(19) }}>{Math.round(utilization * 100)}%</Text>
                <Text className="font-ui-medium" style={{ fontSize: rf(11.5), color: fill }}>{health.label}</Text>
              </View>
              {meter}
              {amounts && <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{amounts}</Text>}
              {highNote && <Text className="font-ui-medium" style={{ fontSize: rf(11), color: colors.warning }}>{highNote}</Text>}
              {excluded && <Text className="font-ui text-text-3" style={{ fontSize: rf(11) }}>{excluded}</Text>}
            </>
          ) : (
            <>
              <View className="gap-1.5 flex-shrink">
                <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5) }}>Credit used</Text>
                {amounts && <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{amounts}</Text>}
                {highNote && <Text className="font-ui-medium" style={{ fontSize: rf(11), color: colors.warning }}>{highNote}</Text>}
                {excluded && <Text className="font-ui text-text-3" style={{ fontSize: rf(11) }}>{excluded}</Text>}
              </View>
              <View className="flex-1 max-w-[100px]">{meter}</View>
              <View className="items-end">
                <Text className="font-ui-semibold text-text" style={{ fontSize: rf(19) }}>{Math.round(utilization * 100)}%</Text>
                <Text className="font-ui-medium" style={{ fontSize: rf(11.5), color: fill }}>{health.label}</Text>
              </View>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}
