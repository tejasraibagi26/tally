import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useColorScheme } from "nativewind";
import { formatCents, formatPercent } from "@tally/core/money";
import { yearTitle, type YearReview } from "@tally/core/yearReview";
import { apiGet } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { MoneyText } from "@/components/ui/MoneyText";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { HeroSurface } from "@/components/overview/PopOverview";
import { useUiLook } from "@/lib/UiLookContext";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { chartSeries } from "@/theme/colors";

// Native port of web's app/(app)/year-in-review/page.tsx, from GET
// /api/year-in-review (apps/web/lib/yearReview.ts): the same sections in
// one column.

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function Tile({ label, children, sub }: { label: string; children: React.ReactNode; sub?: string }) {
  const rf = useRF();
  return (
    <Card className="p-4 gap-1.5 flex-1">
      <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</Text>
      {children}
      {sub && <Text className="font-ui text-text-2" style={{ fontSize: rf(12.5) }}>{sub}</Text>}
    </Card>
  );
}

export default function YearInReviewScreen() {
  const rf = useRF();
  const colors = useThemeColors();
  const contentTop = useScreenContentTop();
  const { pop } = useUiLook();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const q = useQuery({ queryKey: ["year-in-review", year], queryFn: () => apiGet<YearReview>(`/api/year-in-review?year=${year}`) });
  const r = q.data;
  const { colorScheme } = useColorScheme();
  const series = chartSeries[colorScheme === "dark" ? "dark" : "light"];
  const figure = { fontSize: rf(26), lineHeight: rf(30) };

  const heroBody = r && (
    <View className="gap-2">
      <Text className="font-ui-medium text-text-3" style={{ fontSize: rf(11.5), letterSpacing: 0.6, textTransform: "uppercase" }}>Net worth {r.inProgress ? "so far this year" : `in ${r.year}`}</Text>
      {r.netWorth ? (
        <>
          <MoneyText cents={r.netWorth.change} signed className={`font-display ${r.netWorth.change >= 0 ? "text-text" : "text-negative"}`} style={{ fontSize: rf(40), lineHeight: rf(44) }} />
          <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>
            From <MoneyText cents={r.netWorth.start} className="text-text-2" style={{ fontSize: rf(14) }} /> {r.netWorth.fromJan1 ? "on Jan 1" : `on ${shortDate(r.netWorth.startDate)}, when tracking began,`} to <MoneyText cents={r.netWorth.now} className="text-text-2" style={{ fontSize: rf(14) }} />.
          </Text>
        </>
      ) : (
        <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}>No net worth history for {r.year} yet.</Text>
      )}
    </View>
  );

  const maxSpend = Math.max(1, ...(r?.months.map((m) => m.spend) ?? [1]));

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingBottom: 40 }}>
        <View className="flex-row items-center justify-between px-1">
          <Text className="font-display text-text" style={{ fontSize: rf(26) }}>{r ? `Your ${yearTitle(r)}` : `Your ${year}`}</Text>
          <View className="flex-row gap-4">
            <Pressable onPress={() => setYear(year - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Show ${year - 1}`}>
              <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(14) }}>← {year - 1}</Text>
            </Pressable>
            {year < thisYear && (
              <Pressable onPress={() => setYear(year + 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Show ${year + 1}`}>
                <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(14) }}>{year + 1} →</Text>
              </Pressable>
            )}
          </View>
        </View>

        {q.isLoading || !r ? (
          <ActivityIndicator className="mt-8" />
        ) : r.months.length === 0 ? (
          <Text className="font-ui text-text-2 px-1" style={{ fontSize: rf(14) }}>Nothing recorded for {r.year}.</Text>
        ) : (
          <>
            <Text className="font-ui text-text-3 px-1" style={{ fontSize: rf(13) }}>{r.transactionCount.toLocaleString("en-US")} transactions</Text>
            {pop ? <HeroSurface>{heroBody}</HeroSurface> : <Card className="p-5">{heroBody}</Card>}

            <View className="flex-row gap-3">
              <Tile label="Money in">
                <MoneyText cents={r.income} className="font-display text-text" style={figure} />
              </Tile>
              <Tile label="Money out">
                <MoneyText cents={r.spend} mask={false} className="font-display text-text" style={figure} />
              </Tile>
            </View>
            <Tile label={r.saved >= 0 ? "Saved" : "Spent more than came in"} sub={r.savingsRate != null && r.saved >= 0 ? `${formatPercent(r.savingsRate)} of what came in` : undefined}>
              <MoneyText cents={Math.abs(r.saved)} className="font-display text-text" style={figure} />
            </Tile>

            <Card className="overflow-hidden">
              <Text className="font-display text-text px-5 pt-4" style={{ fontSize: rf(17) }}>Month by month</Text>
              {/* Bars run edge to edge; labels stay padded under them. */}
              <View className="flex-row items-end mt-3" style={{ height: 150, gap: 3 }}>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = r.months[i];
                  const top = m && r.biggestMonth?.month === m.month;
                  return (
                    <View key={i} className="flex-1 h-full justify-end">
                      {m && <View style={{ height: `${Math.max(2, (m.spend / maxSpend) * 100)}%`, backgroundColor: top ? colors.marigold ?? colors.warning : series[0], borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />}
                    </View>
                  );
                })}
              </View>
              <View className="flex-row px-1 py-2" style={{ gap: 3, borderTopWidth: 1, borderTopColor: colors.border }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <Text key={i} className="flex-1 text-center font-ui text-text-3" style={{ fontSize: rf(11) }}>
                    {new Date(Date.UTC(r.year, i, 1)).toLocaleDateString("en-US", { month: "narrow", timeZone: "UTC" })}
                  </Text>
                ))}
              </View>
            </Card>

            <Card className="p-5 gap-3.5">
              <Text className="font-display text-text" style={{ fontSize: rf(17) }}>Where it went</Text>
              {r.topCategories.map((c, i) => (
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

            <Card className="p-5 gap-3">
              <Text className="font-display text-text" style={{ fontSize: rf(17) }}>Top places</Text>
              {r.topMerchants.map((m, i) => (
                <View key={m.key} className="flex-row items-center gap-3">
                  <View className="items-center justify-center rounded-control" style={{ width: 32, height: 32, backgroundColor: colors.sunken, borderWidth: pop ? 2 : 0, borderColor: colors.ink ?? colors.border }}>
                    <Text className="font-display text-text" style={{ fontSize: rf(14) }}>{i + 1}</Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="font-ui text-text" style={{ fontSize: rf(14) }} numberOfLines={1}>{m.label}</Text>
                    {m.count != null && <Text className="font-ui text-text-3" style={{ fontSize: rf(12) }}>{m.count} time{m.count === 1 ? "" : "s"}</Text>}
                  </View>
                  <Text className="font-ui text-text" style={{ fontSize: rf(14), fontVariant: ["tabular-nums"] }}>{formatCents(m.total)}</Text>
                </View>
              ))}
            </Card>

            <View className="flex-row gap-3">
              <Tile label="Biggest month" sub={r.biggestMonth ? `${formatCents(r.biggestMonth.spend)} spent` : "Once a month has finished"}>
                <Text className="font-display text-text" style={figure}>{r.biggestMonth?.label ?? "—"}</Text>
              </Tile>
              <Tile label="Calmest month" sub={r.calmestMonth ? `${formatCents(r.calmestMonth.spend)} spent` : "Once two have finished"}>
                <Text className="font-display text-text" style={figure}>{r.calmestMonth?.label ?? "—"}</Text>
              </Tile>
            </View>
            <Tile label="Subscriptions" sub={`${r.subscriptions.activeCount} active, at today's prices`}>
              <Text className="font-display text-text" style={figure}>
                {formatCents(r.subscriptions.yearlyTotal)}
                <Text className="font-ui text-text-2" style={{ fontSize: rf(14) }}> a year</Text>
              </Text>
            </Tile>
          </>
        )}
      </ScrollView>
    </View>
  );
}
