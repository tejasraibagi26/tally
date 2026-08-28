import { LinearGradient } from "expo-linear-gradient";
import { useColorScheme } from "nativewind";
import { useEffect } from "react";
import { View, useWindowDimensions } from "react-native";
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
// fixed at the top instead of scrolling away with the content. A
// horizontal band (transparent -> brand -> transparent) that travels left
// to right, vanishes off the right edge, pauses briefly, then instantly
// resets to the left and starts again -- a one-way loop, not a back-and-
// forth ping-pong. Uses a plain View transform (translateX) rather than an
// animated SVG gradient prop -- react-native-svg doesn't reliably re-paint
// a <Rect>'s referenced gradient def when only the def's own props change
// via Reanimated, so an earlier version rendered but never actually moved.
export function ScreenGlow({ height = 260 }: { height?: number }) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  // A dark-on-light wash reads far more subtly than the same alpha of a
  // light tint on a near-black canvas (display contrast, not just the
  // numbers) -- light mode needed a noticeably higher alpha to actually be
  // visible instead of all but disappearing into the off-white canvas.
  const alpha = colorScheme === "dark" ? 0.14 : 0.4;
  const bandWidth = Math.max(width * 0.6, 220);

  const sweep = useSharedValue(-bandWidth);
  useEffect(() => {
    sweep.value = -bandWidth;
    sweep.value = withRepeat(
      withSequence(
        withTiming(width, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withDelay(500, withTiming(-bandWidth, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [sweep, width, bandWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value }],
  }));

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height, overflow: "hidden" }}>
      <AnimatedLinearGradient
        colors={[withAlpha(colors.brand, 0), withAlpha(colors.brand, alpha), withAlpha(colors.brand, 0)]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[{ position: "absolute", top: 0, width: bandWidth, height }, animatedStyle]}
      />
    </View>
  );
}
