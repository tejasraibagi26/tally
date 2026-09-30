import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CHANGELOG, type ChangeKind } from "@/lib/changelog";
import { APP_VERSION } from "@/lib/version";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { hairline } from "@/theme/colors";
import { ScreenGlow } from "@/components/ui/ScreenGlow";
import { useScreenContentTop } from "@/components/ui/ScreenHeader";

// Mobile port of web's /settings/changelog: reached only from the build
// line at the bottom of the More sheet (see more.tsx), never from a menu.
// Changes are grouped under one colored label per kind, so every line of
// text starts at the same edge.
const KIND_ORDER: ChangeKind[] = ["new", "improved", "fixed"];
const KIND_LABEL: Record<ChangeKind, string> = { new: "New", improved: "Improved", fixed: "Fixed" };

function formatDate(date: string): string {
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function ChangelogScreen() {
  const colors = useThemeColors();
  const rf = useRF();
  const insets = useSafeAreaInsets();
  const contentTop = useScreenContentTop();
  const kindColor: Record<ChangeKind, string> = { new: colors.brand, improved: colors.info, fixed: colors["text-3"] };

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: contentTop }}>
      <ScreenGlow />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}
      >
        <Text className="font-ui text-text-2 mb-2" style={{ fontSize: rf(13.5) }}>
          You&apos;re on v{APP_VERSION}.
        </Text>
        {CHANGELOG.map((entry, i) => (
          <View key={entry.version} className="gap-3.5" style={[{ paddingVertical: 22 }, i > 0 ? { borderTopWidth: 1, borderTopColor: hairline(colors) } : null]}>
            <View className="flex-row items-center gap-2.5 flex-wrap">
              <Text className="text-text" style={{ fontFamily: "JetBrainsMono_Medium", fontSize: rf(15) }}>v{entry.version}</Text>
              <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>{formatDate(entry.date)}</Text>
              {entry.version === APP_VERSION && (
                <View className="px-2 rounded-full bg-positive-subtle" style={{ paddingVertical: 2 }}>
                  <Text className="font-ui-medium text-positive" style={{ fontSize: rf(11) }}>Current</Text>
                </View>
              )}
            </View>
            {KIND_ORDER.filter((kind) => entry.changes.some((c) => c.kind === kind)).map((kind) => (
              <View key={kind} className="gap-1.5">
                <View className="flex-row items-center gap-2">
                  <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: kindColor[kind] }} />
                  <Text className="font-ui-semibold" style={{ fontSize: rf(11), letterSpacing: 0.6, textTransform: "uppercase", color: kindColor[kind] }}>
                    {KIND_LABEL[kind]}
                  </Text>
                </View>
                {entry.changes
                  .filter((c) => c.kind === kind)
                  .map((c) => (
                    <Text key={c.text} className="font-ui text-text" style={{ fontSize: rf(14.5), lineHeight: rf(22) }}>
                      {c.text}
                    </Text>
                  ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
