import { useEffect, useRef } from "react";
import { Animated, View, type StyleProp, type ViewStyle } from "react-native";

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

/**
 * A loading Card of list rows (avatar, two lines, an amount), the shape most
 * screens fill in, so a list never loads behind a bare spinner.
 */
export function SkeletonList({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <View className="bg-surface rounded-card border-card border-ink px-5" accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className={`flex-row items-center gap-3 py-4 ${i > 0 ? "border-t border-border" : ""}`}>
          {avatar && <Skeleton className="rounded-full" style={{ width: 32, height: 32 }} />}
          <View className="flex-1 gap-1.5">
            <Skeleton style={{ height: 12, width: `${70 - ((i * 13) % 30)}%` }} />
            <Skeleton style={{ height: 10, width: "40%" }} />
          </View>
          <Skeleton style={{ height: 12, width: 64 }} />
        </View>
      ))}
    </View>
  );
}

/**
 * A whole screen still loading: a hero figure and a couple of cards. For
 * screens whose first paint has nothing to show yet.
 */
export function SkeletonScreen({ top = 0 }: { top?: number }) {
  return (
    <View className="gap-4 px-5" style={{ paddingTop: top + 8 }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <Skeleton style={{ height: 11, width: 120 }} />
      <Skeleton style={{ height: 36, width: 200 }} />
      <Skeleton style={{ height: 160, borderRadius: 18, marginTop: 4 }} />
      <SkeletonList rows={3} />
    </View>
  );
}
