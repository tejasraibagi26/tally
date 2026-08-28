import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "nativewind";
import { useThemeColors } from "@/theme/useThemeColors";
import { withAlpha } from "@/theme/colors";

// A soft brand-tinted glow pinned behind the top of a tab screen -- sits
// behind the header/hero content, not inside the ScrollView, so it stays
// fixed at the top instead of scrolling away with the content.
export function ScreenGlow({ height = 260 }: { height?: number }) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  // A dark-on-light wash reads far more subtly than the same alpha of a
  // light tint on a near-black canvas (display contrast, not just the
  // numbers) -- light mode needed a noticeably higher alpha to actually be
  // visible instead of all but disappearing into the off-white canvas.
  const alpha = colorScheme === "dark" ? 0.14 : 0.4;
  return (
    <LinearGradient
      colors={[withAlpha(colors.brand, alpha), withAlpha(colors.brand, 0)]}
      style={{ position: "absolute", top: 0, left: 0, right: 0, height }}
      pointerEvents="none"
    />
  );
}
