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
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { useThemeColors } from "@/theme/useThemeColors";
import { withAlpha } from "@/theme/colors";

// Two layers: a static brand-tinted wash behind the top of a tab screen
// (fading top -> bottom, same as this started as), and a radial highlight
// on top of it that sweeps left to right, vanishes off the right edge,
// pauses briefly, then instantly resets to the left -- a moving accent
// over a fixed backdrop, not a replacement for it. Both sit behind the
// header/hero content, not inside the ScrollView, so they stay fixed at
// the top instead of scrolling away. The orb's own gradient stays static;
// only the wrapping View's translateX animates -- react-native-svg
// doesn't reliably re-paint a <Rect>'s referenced gradient def when only
// the def's own props (e.g. cx) change via Reanimated, so an earlier
// version that animated the gradient directly rendered but never moved.
export function ScreenGlow({ height = 260 }: { height?: number }) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  // A dark-on-light wash reads far more subtly than the same alpha of a
  // light tint on a near-black canvas (display contrast, not just the
  // numbers) -- light mode needed a noticeably higher alpha to actually be
  // visible instead of all but disappearing into the off-white canvas.
  const baseAlpha = colorScheme === "dark" ? 0.14 : 0.4;
  const orbAlpha = 0.1;
  const orbSize = 380;

  const sweep = useSharedValue(-orbSize);
  useEffect(() => {
    sweep.value = -orbSize;
    sweep.value = withRepeat(
      withSequence(
        withTiming(width, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withDelay(500, withTiming(-orbSize, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [sweep, width, orbSize]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value }],
  }));

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height, overflow: "hidden" }}>
      <LinearGradient
        colors={[withAlpha(colors.brand, baseAlpha), withAlpha(colors.brand, 0)]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height }}
      />
      <Animated.View style={[{ position: "absolute", top: -orbSize * 0.5, width: orbSize, height: orbSize }, animatedStyle]}>
        <Svg width={orbSize} height={orbSize}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.brand} stopOpacity={orbAlpha} />
              <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width={orbSize} height={orbSize} fill="url(#glow)" />
        </Svg>
      </Animated.View>
    </View>
  );
}
