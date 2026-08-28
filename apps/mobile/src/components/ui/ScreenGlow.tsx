import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useThemeColors } from "@/theme/useThemeColors";
import { withAlpha } from "@/theme/colors";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

// A soft brand-tinted glow pinned behind the top of a tab screen -- sits
// behind the header/hero content, not inside the ScrollView, so it stays
// fixed at the top instead of scrolling away with the content. Breathes
// gently rather than sitting static, so it reads as alive without being
// distracting.
export function ScreenGlow({ height = 260 }: { height?: number }) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  // A dark-on-light wash reads far more subtly than the same alpha of a
  // light tint on a near-black canvas (display contrast, not just the
  // numbers) -- light mode needed a noticeably higher alpha to actually be
  // visible instead of all but disappearing into the off-white canvas.
  const alpha = colorScheme === "dark" ? 0.14 : 0.4;

  // A continuous sine breathe read as static -- a real pulse needs a fast
  // rise, a slower decay, and a pause between beats, not one smooth cycle.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 450, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withDelay(500, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  return (
    <AnimatedLinearGradient
      colors={[withAlpha(colors.brand, alpha), withAlpha(colors.brand, 0)]}
      style={[
        { position: "absolute" as const, top: 0, left: 0, right: 0, height },
        animatedStyle,
      ]}
      pointerEvents="none"
    />
  );
}
