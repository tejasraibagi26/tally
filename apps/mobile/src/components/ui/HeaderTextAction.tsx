import { Pressable, Text, ActivityIndicator } from "react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * Plain brand-colored text for a pushed screen's native header right slot
 * (e.g. "Add") -- same treatment as Investments' Sync. Pass it through both
 * headerRight (Android) and unstable_headerRightItems with
 * hidesSharedBackground (iOS 26, to skip the Liquid Glass button chrome);
 * see app/investments.tsx for why.
 */
export function HeaderTextAction({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const colors = useThemeColors();
  const rf = useRF();
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} hitSlop={10} className="px-2 py-1" accessibilityRole="button" accessibilityLabel={label}>
      {busy ? <ActivityIndicator size="small" color={colors.brand} /> : <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(15) }}>{label}</Text>}
    </Pressable>
  );
}
