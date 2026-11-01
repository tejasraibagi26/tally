import { Text, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { TallyMarks } from "@/components/ui/TallyMarks";

/** A slim brand-colored call to action into the review queue; nothing renders at zero. */
export function ReviewCard({ count }: { count: number }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  if (count <= 0) return null;
  // "N to tally up" on a lilac sticker with a tile of marks.
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
