import { useEffect, useRef } from "react";
import { Animated, View, Text } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

/**
 * RN port of apps/web/components/ui/EmptyState.tsx — same "icon-in-a-circle,
 * or a fully custom illustration" split. `illustration` is expected to
 * drive its own idle animation (see EmptyPeriodIllustration.tsx); the pop-in
 * here only wraps whichever of the two is passed. Uses RN's built-in
 * Animated (matches components/ui/Skeleton.tsx's convention) rather than
 * react-native-reanimated, which is installed but unused elsewhere.
 */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
}: {
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 60 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [scale, opacity]);

  return (
    <View className="items-center gap-3">
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        {illustration ??
          (Icon && (
            <View className="w-14 h-14 rounded-full items-center justify-center bg-brand-subtle">
              <Icon size={26} color={colors.brand} strokeWidth={1.75} />
            </View>
          ))}
      </Animated.View>
      <Text className="font-display text-text text-center" style={{ fontSize: rf(22) }}>
        {title}
      </Text>
      {description && (
        <Text className="font-ui text-text-2 text-center" style={{ fontSize: rf(14) }}>
          {description}
        </Text>
      )}
    </View>
  );
}
