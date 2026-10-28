import { View, Text, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Tag } from "lucide-react-native";
import { formatCents } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { useTags } from "@/lib/queries/tags";

// Native port of web's app/(app)/tags/page.tsx: every tag, most recently
// used first, each opening its rollup (app/tag/[tag].tsx).

function range(first: string, last: string): string {
  const f = (d: string, year: boolean) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: year ? "numeric" : undefined, timeZone: "UTC" });
  if (first === last) return f(first, true);
  return `${f(first, first.slice(0, 4) !== last.slice(0, 4))} – ${f(last, true)}`;
}

export default function TagsScreen() {
  const rf = useRF();
  const colors = useThemeColors();
  const router = useRouter();
  const contentTop = useScreenContentTop();
  const { data, isLoading } = useTags();

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 40 }}>
        {isLoading ? (
          <ActivityIndicator className="mt-8" />
        ) : (data?.tags.length ?? 0) === 0 ? (
          // Same card, icon and words as web's Tags page (app/(app)/tags/page.tsx), with mobile's own way to tag.
          <Card className="py-10 px-5">
            <EmptyState
              icon={Tag}
              title="No tags yet"
              description="Tag transactions to add them up across categories, like a trip's flights, hotels and meals. Tag one from its Note and tags, select several on the web and choose Tag, or have a rule do it."
            />
          </Card>
        ) : (
          data!.tags.map((t) => (
            <Pressable key={t.tag} onPress={() => router.push(`/tag/${encodeURIComponent(t.tag)}` as Href)} accessibilityRole="button" accessibilityLabel={`${t.tag}: ${formatCents(t.spend)}`}>
              <Card className="p-4 gap-1.5">
                <View className="self-start flex-row items-center gap-1.5 rounded-full px-2.5 py-0.5" style={{ backgroundColor: colors["brand-subtle"] }}>
                  <Tag size={12} color={colors.brand} strokeWidth={2.2} />
                  <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>{t.tag}</Text>
                </View>
                <Text className="font-display text-text" style={{ fontSize: rf(26), lineHeight: rf(30), fontVariant: ["tabular-nums"] }}>{formatCents(t.spend)}</Text>
                <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }}>
                  {t.count} transaction{t.count === 1 ? "" : "s"} · {range(t.firstDate, t.lastDate)}
                </Text>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}
