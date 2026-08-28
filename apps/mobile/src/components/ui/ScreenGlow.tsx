import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/theme/useThemeColors";
import { withAlpha } from "@/theme/colors";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// A soft brand-tinted glow pinned behind the top of a tab screen -- sits
// behind the header/hero content, not inside the ScrollView, so it stays
// fixed at the top instead of scrolling away with the content. A smooth,
// continuous breathe (symmetric ease in/out, no discontinuity) rather than
// a fast-rise heartbeat -- the quick attack read as a flash/blink instead
// of a pulse.
export function ScreenGlow({ height = 260 }: { height?: number }) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  // A dark-on-light wash reads far more subtly than the same alpha of a
  // light tint on a near-black canvas (display contrast, not just the
  // numbers) -- light mode needed a noticeably higher alpha to actually be
  // visible instead of all but disappearing into the off-white canvas.
  const alpha = colorScheme === "dark" ? 0.14 : 0.4;

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
  }));

  return (
    <AnimatedLinearGradient
      colors={[withAlpha(colors.brand, alpha), withAlpha(colors.brand, 0)]}
      style={[{ position: "absolute", top: 0, left: 0, right: 0, height }, animatedStyle]}
      pointerEvents="none"
    />
  );
}
