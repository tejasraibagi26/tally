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
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useThemeColors } from "@/theme/useThemeColors";

// A soft brand-tinted glow pinned behind the top of a tab screen -- sits
// behind the header/hero content, not inside the ScrollView, so it stays
// fixed at the top instead of scrolling away with the content. Radial
// (centered, fading outward in every direction) rather than linear (a flat
// top-to-bottom band) so it reads as a light source, not a tinted strip.
// Pulses like a heartbeat -- fast rise, slower decay, a pause between beats
// -- rather than a continuous breathe, which read as static motion.
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
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: 0, left: 0, right: 0, height }, animatedStyle]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="0%" rx="65%" ry="100%">
            <Stop offset="0" stopColor={colors.brand} stopOpacity={alpha} />
            <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#glow)" />
      </Svg>
    </Animated.View>
  );
}
