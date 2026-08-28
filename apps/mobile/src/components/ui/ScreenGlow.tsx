import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useThemeColors } from "@/theme/useThemeColors";

const AnimatedRadialGradient = Animated.createAnimatedComponent(RadialGradient);

// A soft brand-tinted glow pinned behind the top of a tab screen -- sits
// behind the header/hero content, not inside the ScrollView, so it stays
// fixed at the top instead of scrolling away with the content. Radial
// (fading outward in every direction from a point) rather than linear (a
// flat top-to-bottom band) so it reads as a light source, not a tinted
// strip. Two animations layered on top of that light source: a heartbeat
// brightness pulse (fast rise, slower decay, a pause -- a continuous
// breathe read as static), and the light source itself sweeping left to
// right and back, off-screen at both ends so it doesn't pop in/out.
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

  const sweep = useSharedValue(-15);
  useEffect(() => {
    sweep.value = withRepeat(withTiming(115, { duration: 3400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [sweep]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  const animatedGradientProps = useAnimatedProps(() => ({
    cx: `${sweep.value}%`,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: 0, left: 0, right: 0, height }, animatedStyle]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <AnimatedRadialGradient id="glow" animatedProps={animatedGradientProps} cy="0%" rx="40%" ry="100%">
            <Stop offset="0" stopColor={colors.brand} stopOpacity={alpha} />
            <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
          </AnimatedRadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#glow)" />
      </Svg>
    </Animated.View>
  );
}
