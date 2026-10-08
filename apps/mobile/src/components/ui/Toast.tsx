import { useEffect, useState } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

const TOAST_MS = 4000;
/** A toast with an action (Undo) stays a little longer so there's time to reach it. */
const ACTION_TOAST_MS = 5000;

/**
 * Bottom-center, above the tab bar (MOBILE_DESIGN.md's toast row): a short
 * confirmation that fades out on its own. With an `action` it becomes
 * tappable and holds for 5s -- "Netflix won't show again · Undo".
 */
export function Toast({
  message,
  onHidden,
  bottom,
  action,
  tone = "positive",
}: {
  message: string | null;
  onHidden: () => void;
  bottom: number;
  action?: { label: string; onPress: () => void };
  /** "negative" for a quick action that failed (e.g. an export); the dot turns red. */
  tone?: "positive" | "negative";
}) {
  const rf = useRF();
  const colors = useThemeColors();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(
      () => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => onHidden());
      },
      action ? ACTION_TOAST_MS : TOAST_MS,
    );
    return () => clearTimeout(t);
    // The action's identity changing mid-toast shouldn't restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, opacity, onHidden]);

  if (!message) return null;
  return (
    <Animated.View pointerEvents={action ? "box-none" : "none"} style={{ position: "absolute", left: 0, right: 0, bottom, alignItems: "center", opacity }}>
      <View className="flex-row items-center gap-2 rounded-full bg-raised px-4 py-2.5" style={{ borderWidth: 1, borderColor: colors.border }} accessibilityLiveRegion="polite">
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone === "negative" ? colors.negative : colors.positive }} />
        <Text className="font-ui-medium text-text" style={{ fontSize: rf(13) }}>{message}</Text>
        {action && (
          <Pressable
            onPress={() => {
              action.onPress();
              onHidden();
            }}
            hitSlop={12}
            className="ml-1"
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Text className="font-ui-semibold text-brand" style={{ fontSize: rf(13) }}>{action.label}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
