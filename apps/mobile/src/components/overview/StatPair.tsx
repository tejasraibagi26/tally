import { View, Text, Pressable, PixelRatio, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { creditHealth } from "@tally/core/overviewView";
import { formatPercent } from "@tally/core/money";
import { MoneyText } from "@/components/ui/MoneyText";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Investments and Credit used, side by side. One tile fills the row; none
 * renders nothing. Stacks to a column on narrow screens or large text.
 */
export function StatPair({ investmentsCents, utilization }: { investmentsCents: number | null; utilization: number | null }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const { width } = useWindowDimensions();
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

  return (
    <View className={stacked ? "gap-3" : "flex-row gap-3"}>
      {investmentsCents != null && (
        <Pressable onPress={() => router.push("/investments")} className="flex-1 rounded-card bg-surface p-4 gap-1.5 active:opacity-80" accessibilityRole="button" accessibilityLabel="Investments">
          <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5) }}>Investments</Text>
          <MoneyText cents={investmentsCents} className="font-ui-semibold text-text" style={{ fontSize: rf(19) }} numberOfLines={1} adjustsFontSizeToFit />
          <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>Portfolio value</Text>
        </Pressable>
      )}
      {utilization != null && health && (
        <Pressable
          onPress={() => router.push("/(tabs)/accounts")}
          className={`flex-1 rounded-card bg-surface p-4 active:opacity-80 ${both ? "gap-1.5" : "flex-row items-center justify-between gap-4"}`}
          accessibilityRole="button"
          accessibilityLabel={`Credit used ${formatPercent(utilization)}, ${health.label}`}
        >
          {both ? (
            <>
              <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5) }}>Credit used</Text>
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(19) }}>{Math.round(utilization * 100)}%</Text>
              {meter}
              <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{health.label} · of limit</Text>
            </>
          ) : (
            <>
              <View className="gap-1.5">
                <Text className="font-ui-medium text-text-2" style={{ fontSize: rf(11.5) }}>Credit used</Text>
                <Text className="font-ui text-text-3" style={{ fontSize: rf(11.5) }}>{health.label} · of limit</Text>
              </View>
              <View className="flex-1 max-w-[120px]">{meter}</View>
              <Text className="font-ui-semibold text-text" style={{ fontSize: rf(19) }}>{Math.round(utilization * 100)}%</Text>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}
