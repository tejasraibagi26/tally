import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import { formatCents, formatPercent } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { chartSeries } from "@/theme/colors";
import { useTag } from "@/lib/queries/tags";

// Native port of web's app/(app)/tags/[tag]/page.tsx: one tag added up.

function day(d: string, withYear = false): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined, timeZone: "UTC" });
}

export default function TagScreen() {
  const rf = useRF();
  const colors = useThemeColors();
  const contentTop = useScreenContentTop();
  const { colorScheme } = useColorScheme();
  const series = chartSeries[colorScheme === "dark" ? "dark" : "light"];
  const { tag: raw } = useLocalSearchParams<{ tag: string }>();
  const tag = decodeURIComponent(raw ?? "");
  const { data: s, isLoading } = useTag(tag);

  const maxDay = Math.max(1, ...(s?.byDay.map((d) => d.total) ?? [1]));
  const span: { date: string; total: number }[] = [];
  if (s?.firstDate && s.days <= 120) {
    const by = new Map(s.byDay.map((d) => [d.date, d.total]));
    for (let i = 0; i < s.days; i++) {
      const d = new Date(Date.parse(`${s.firstDate}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
      span.push({ date: d, total: by.get(d) ?? 0 });
    }
  }
  const bars = span.length > 0 ? span : (s?.byDay ?? []);
  const figure = { fontSize: rf(26), lineHeight: rf(30), fontVariant: ["tabular-nums" as const] };

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <Stack.Screen options={{ title: tag }} />
      <ScreenGlow />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 40 }}>
        {isLoading || !s ? (
          <ActivityIndicator className="mt-8" />
        ) : (
          <>
            <Text className="font-ui text-text-2 px-1" style={{ fontSize: rf(13.5) }}>
              {s.firstDate && s.lastDate ? (s.firstDate === s.lastDate ? day(s.firstDate, true) : `${day(s.firstDate)} – ${day(s.lastDate, true)}`) : ""} · {s.count} transaction{s.count === 1 ? "" : "s"}
            </Text>
            <Card className="p-5 gap-1.5">
              <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>Total</Text>
              <Text className="font-display text-text" style={{ fontSize: rf(38), lineHeight: rf(42), fontVariant: ["tabular-nums"] }}>{formatCents(s.spend)}</Text>
              {s.income > 0 && <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>{formatCents(s.income)} came back in</Text>}
            </Card>
            <View className="flex-row gap-3">
              <Card className="p-4 gap-1.5 flex-1">
                <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>Per day</Text>
                <Text className="font-display text-text" style={figure}>{s.perDay != null ? formatCents(s.perDay) : "—"}</Text>
                <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>over {s.days} day{s.days === 1 ? "" : "s"}</Text>
              </Card>
              <Card className="p-4 gap-1.5 flex-1">
                <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>Biggest share</Text>
                <Text className="font-display text-text" style={figure} numberOfLines={1}>{s.byCategory[0]?.label ?? "—"}</Text>
                {s.byCategory[0] && <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>{formatPercent(s.byCategory[0].share)} of it</Text>}
              </Card>
            </View>

            {bars.length > 1 && (
              <Card className="overflow-hidden">
                <Text className="font-display text-text px-5 pt-4" style={{ fontSize: rf(17) }}>Day by day</Text>
                {/* Bars run edge to edge; the date labels stay padded. */}
                <View className="flex-row items-end mt-3" style={{ height: 130, gap: 2 }}>
                  {bars.map((b) => (
                    <View key={b.date} className="flex-1 h-full justify-end">
                      {b.total > 0 && <View style={{ height: `${Math.max(3, (b.total / maxDay) * 100)}%`, backgroundColor: series[0], borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />}
                    </View>
                  ))}
                </View>
                <View className="flex-row justify-between px-4 py-2" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(11) }}>{day(bars[0]!.date)}</Text>
                  <Text className="font-ui text-text-3" style={{ fontSize: rf(11) }}>{day(bars.at(-1)!.date)}</Text>
                </View>
              </Card>
            )}

            <Card className="p-5 gap-3.5">
              <Text className="font-display text-text" style={{ fontSize: rf(17) }}>By category</Text>
              {s.byCategory.map((c, i) => (
                <View key={c.key} className="gap-1.5">
                  <View className="flex-row justify-between">
                    <Text className="font-ui text-text flex-1" style={{ fontSize: rf(14) }} numberOfLines={1}>{c.label}</Text>
                    <Text className="font-ui text-text" style={{ fontSize: rf(14), fontVariant: ["tabular-nums"] }}>
                      {formatCents(c.total)} <Text className="text-text-3">· {formatPercent(c.share)}</Text>
                    </Text>
                  </View>
                  <View className="rounded-full overflow-hidden" style={{ height: 8, backgroundColor: colors.sunken }}>
                    <View style={{ width: `${c.share * 100}%`, height: "100%", borderRadius: 999, backgroundColor: series[i % series.length] }} />
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
