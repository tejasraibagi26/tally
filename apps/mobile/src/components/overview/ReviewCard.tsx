import { Text, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Tag } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { useUiLook } from "@/lib/UiLookContext";
import { TallyMarks } from "@/components/ui/TallyMarks";

/** A slim brand-colored call to action into the review queue; nothing renders at zero. */
export function ReviewCard({ count }: { count: number }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  const { pop } = useUiLook();
  if (count <= 0) return null;
  if (pop) {
    // Tally Pop: "N to tally up" on a lilac sticker with a tile of marks.
    return (
      <Pressable
        onPress={() => router.push("/(tabs)/transactions/review")}
        className="flex-row items-center gap-3 rounded-card border-card border-ink bg-brand-subtle px-4 py-3 active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={`${count} to tally up`}
      >
        <View className="w-10 h-10 rounded-control bg-brand items-center justify-center">
          <TallyMarks count={4} height={20} color={colors["on-brand"]!} accent={colors["on-brand"]!} />
        </View>
        <View className="flex-1">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15.5), fontVariant: ["tabular-nums"] }} numberOfLines={1}>{count} to tally up</Text>
          <Text className="font-ui text-text-2" style={{ fontSize: rf(13) }} numberOfLines={1}>Takes about a minute</Text>
        </View>
        <ChevronRight size={18} color={colors.text} strokeWidth={2.5} />
      </Pressable>
    );
  }
  const label = `${count} transaction${count === 1 ? "" : "s"} to review`;
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/transactions/review")}
      className="flex-row items-center gap-2.5 rounded-card px-[18px] py-3.5 active:opacity-80"
      style={{ backgroundColor: colors.brand }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Tag size={16} color={colors["on-brand"]} strokeWidth={2} />
      <Text className="font-ui-semibold flex-1" style={{ fontSize: rf(14.5), color: colors["on-brand"] }} numberOfLines={1}>{label}</Text>
      <ChevronRight size={16} color={colors["on-brand"]} strokeWidth={2} />
    </Pressable>
  );
}
