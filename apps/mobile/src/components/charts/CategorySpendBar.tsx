import { View, Text } from "react-native";
import { useColorScheme } from "nativewind";
import { MoneyText } from "@/components/ui/MoneyText";
import { chartSeries } from "@/theme/colors";
import { useRF } from "@/theme/responsiveFont";
import type { BreakdownRow } from "@/lib/queries/spendBreakdown";

// Matches web's CategorySpendBar (DESIGN.md §7.2 "Portfolio allocation"
// pattern) — one stacked horizontal bar, ranked-by-position color (not
// row.colorSlot, which is shared across every category under the same
// parent), labeled legend below.
export function CategorySpendBar({ rows, limit = 6 }: { rows: BreakdownRow[]; limit?: number }) {
  const rf = useRF();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const top = rows.slice(0, limit);
  const total = top.reduce((s, r) => s + r.total, 0) || 1;

  if (top.length === 0) {
    return (
      <Text className="font-ui text-text-2 text-center py-8" style={{ fontSize: rf(14.5) }}>
        No spend in this period yet.
      </Text>
    );
  }

  return (
    <View className="gap-4 py-1">
      <View className="flex-row h-3.5 gap-0.5 rounded-full overflow-hidden">
        {top.map((row, i) => (
          <View key={row.key} style={{ width: `${(row.total / total) * 100}%`, backgroundColor: series[i % series.length] }} />
        ))}
      </View>
      <View className="gap-2.5">
        {top.map((row, i) => (
          <View key={row.key} className="flex-row items-center gap-2">
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: series[i % series.length] }} />
            <Text className="flex-1 font-ui text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>
              {row.label}
            </Text>
            <MoneyText cents={row.total} mask={false} className="font-ui-medium text-text-2" style={{ fontSize: rf(14) }} />
          </View>
        ))}
      </View>
    </View>
  );
}
