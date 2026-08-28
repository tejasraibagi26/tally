import { LinearGradient } from "expo-linear-gradient";
import { useThemeColors } from "@/theme/useThemeColors";
import { withAlpha } from "@/theme/colors";

// A soft brand-tinted glow pinned behind the top of a tab screen -- sits
// behind the header/hero content, not inside the ScrollView, so it stays
// fixed at the top instead of scrolling away with the content.
export function ScreenGlow({ height = 260 }: { height?: number }) {
  const colors = useThemeColors();
  return (
    <LinearGradient
      colors={[withAlpha(colors.brand, 0.14), withAlpha(colors.brand, 0)]}
      style={{ position: "absolute", top: 0, left: 0, right: 0, height }}
      pointerEvents="none"
    />
  );
}
