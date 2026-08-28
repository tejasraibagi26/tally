import { useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

// DESIGN.md §8: "shape-matched blocks in --sunken with a shimmer. Never a
// centered spinner on a full page." Mirrors web's Skeleton.tsx (Tailwind's
// animate-pulse) -- RN has no CSS animation utility, so a looping opacity
// tween does the same "gently pulsing block" job.
export function Skeleton({ className, style }: { className?: string; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View className={`bg-sunken rounded-control ${className ?? ""}`} style={[{ opacity }, style]} />;
}
