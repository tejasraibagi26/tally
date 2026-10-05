import { Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, Tag } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/** A slim brand-colored call to action into the review queue; nothing renders at zero. */
export function ReviewCard({ count }: { count: number }) {
  const router = useRouter();
  const colors = useThemeColors();
  const rf = useRF();
  if (count <= 0) return null;
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
