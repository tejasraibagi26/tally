import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, View, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { withAlpha } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

const SCREEN_HEIGHT = Dimensions.get("window").height;
// Damping/stiffness tuned to read like iOS's own sheet spring (a quick
// settle with a hint of overshoot) rather than a generic ease -- MOBILE_DESIGN.md
// §"Bottom sheet open/close" calls for "physically dragged," not a fixed-duration tween.
const OPEN_SPRING = { damping: 30, stiffness: 300, mass: 0.9 };
const CLOSE_DURATION = 220;
const DRAG_CLOSE_VELOCITY = 900; // px/s -- a fast flick closes even without crossing the distance threshold

/**
 * Shared shell for every bottom sheet (MOBILE_DESIGN.md's mobile equivalent
 * of web's side panel/modal): native-style grabber handle, spring-in on
 * open, swipe-down-to-dismiss from the handle, and a tap-out backdrop.
 * Callers keep their own header/content -- this only owns the shell chrome
 * and the open/close motion. `onClose` is called once the close animation
 * finishes (so a caller doesn't need to fake the timing itself); on the
 * Android hardware back button the same animated close runs first.
 */
export function Sheet({
  visible,
  onClose,
  children,
  maxHeight = "85%",
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: ViewStyle["maxHeight"];
}) {
  const colors = useThemeColors();
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const dragStart = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = reduceMotion ? 0 : withSpring(0, OPEN_SPRING);
    } else if (mounted) {
      if (reduceMotion) {
        translateY.value = SCREEN_HEIGHT;
        setMounted(false);
      } else {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: CLOSE_DURATION }, (finished) => {
          if (finished) runOnJS(setMounted)(false);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      dragStart.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, dragStart.value + e.translationY);
    })
    .onEnd((e) => {
      const shouldClose = translateY.value > 100 || e.velocityY > DRAG_CLOSE_VELOCITY;
      if (shouldClose) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: CLOSE_DURATION }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, OPEN_SPRING);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT * 0.6], [0.42, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000000" }, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>
        {/* Keyboard avoidance lives here, around the sheet's own bottom-anchoring container --
            not inside a consumer's children, which sit inside an already-positioned
            Animated.View and can't move it. "padding" on iOS pads this container's bottom by
            the keyboard height, which pushes the flex-end-anchored sheet up above it. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end" }}
          pointerEvents="box-none"
        >
          <Animated.View className="bg-canvas rounded-t-panel overflow-hidden" style={[{ maxHeight }, sheetStyle]}>
            <GestureDetector gesture={panGesture}>
              <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }} hitSlop={{ top: 12, bottom: 12, left: 48, right: 48 }}>
                <View style={{ width: 36, height: 5, borderRadius: 999, backgroundColor: withAlpha(colors["text-3"], 0.35) }} />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
