import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { hairline } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/** The small caps label over a group on the Goals tabs. */
export function SectionLabel({ children, right }: { children: string; right?: ReactNode }) {
  const rf = useRF();
  return (
    <View className="flex-row items-center justify-between px-1 -mb-1">
      <Text className="font-ui-semibold text-text-3" style={{ fontSize: rf(12), letterSpacing: 0.6, textTransform: "uppercase" }}>
        {children}
      </Text>
      {right}
    </View>
  );
}

/** A settings-style row inside a card: label, value, chevron when it opens something. */
export function GoalRow({
  label,
  value,
  onPress,
  tone,
  first,
  accessibilityLabel,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  tone?: "negative";
  first?: boolean;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel ?? (value ? `${label}, ${value}` : label)}
      className="flex-row items-center gap-3 min-h-[52px] py-3 active:opacity-70"
      style={first ? undefined : { borderTopWidth: 1, borderTopColor: hairline(colors) }}
    >
      <Text className={`flex-1 ${tone ? "font-ui-semibold" : "font-ui"}`} style={{ fontSize: rf(15), color: tone ? colors.negative : colors.text }}>
        {label}
      </Text>
      {value != null && (
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(15), fontVariant: ["tabular-nums"] }}>
          {value}
        </Text>
      )}
      {onPress && !tone && <ChevronRight size={16} color={colors["text-3"]} strokeWidth={2} />}
    </Pressable>
  );
}
