import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Dimensions, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { NativeBlur } from "@/components/ui/nativeBlur";
import { useColorScheme } from "nativewind";
import { useThemeColors } from "@/theme/useThemeColors";

const SCREEN_HEIGHT = Dimensions.get("window").height;
// Damping/stiffness tuned to read like iOS's own sheet spring (a quick
// settle with a hint of overshoot) rather than a generic ease -- MOBILE_DESIGN.md
// §"Bottom sheet open/close" calls for "physically dragged," not a fixed-duration tween.
const OPEN_SPRING = { damping: 30, stiffness: 300, mass: 0.9 };
const CLOSE_DURATION = 220;
// Floating-card geometry: an 8pt inset all round, and corners concentric
// with the phone's display corners (~55pt on Face ID iPhones, minus the
// inset). Android displays are less rounded, so a smaller radius there.
const SHEET_GAP = 8;
const SHEET_RADIUS = Platform.OS === "ios" ? 46 : 28;
const DRAG_CLOSE_VELOCITY = 900; // px/s -- a fast flick closes even without crossing the distance threshold

/**
 * Shared shell for every bottom sheet (MOBILE_DESIGN.md's mobile equivalent
 * of web's side panel/modal): a floating card (inset 8pt, all corners
 * rounded), native-style grabber handle, spring-in on
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
  maxHeight = "90%",
  dismissible = true,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: ViewStyle["maxHeight"];
  /** False while work is running that mustn't be abandoned: no grabber, no swipe, backdrop taps and Android back ignored. */
  dismissible?: boolean;
}) {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const dragStart = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    // The bottom safe-area padding below is only for clearing the home
    // indicator -- once the keyboard is docked it already covers that
    // strip, so keeping the padding just leaves a dead gap above the
    // keyboard (between it and a sheet's own submit button).
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
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
    .enabled(dismissible)
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
    opacity: interpolate(translateY.value, [0, SCREEN_HEIGHT * 0.6], [NativeBlur ? 0.3 : 0.42, 0], Extrapolation.CLAMP),
  }));

  // Every sheet's content already ends with its own bottom padding (a
  // footer's 24px, a list's trailing padding), so adding iOS's full
  // home-indicator inset (34pt) on top left a tall empty band under the
  // last button. On iOS only the part of the inset not already covered by
  // that padding is added -- the indicator sits in the bottom ~13pt, well
  // inside it. Android keeps the full inset (gesture/nav bar).
  const bottomPad = Platform.OS === "ios" ? Math.max(8, insets.bottom - 20) : insets.bottom;
  // The sheet floats like iOS's own (and Spotify's) card sheets: inset from
  // the sides and bottom, every corner rounded concentric with the screen's.
  // The gap is taken out of bottomPad, not added to it, so content ends the
  // same distance from the screen edge as before (no double-counted inset).
  const gap = SHEET_GAP;
  // iOS: the home indicator may overlap the card, as on native sheets.
  // Android: the card floats above the nav bar, never over it.
  const innerBottom = keyboardVisible || Platform.OS === "android" ? 0 : Math.max(0, bottomPad - gap);
  const outerBottom = keyboardVisible || Platform.OS === "ios" ? gap : insets.bottom + gap;

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={dismissible ? onClose : () => {}} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000000" }, backdropStyle]}>
          <Pressable style={{ flex: 1 }} onPress={dismissible ? onClose : undefined} />
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
          <Animated.View
            className={NativeBlur ? "overflow-hidden" : "bg-raised overflow-hidden"}
            style={[
              {
                maxHeight,
                marginHorizontal: gap,
                marginBottom: outerBottom,
                paddingBottom: innerBottom,
                borderRadius: SHEET_RADIUS,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.border,
              },
              sheetStyle,
            ]}
          >
            {/* See-through like Spotify's sheets: the screen behind blurs through a
                translucent wash of the sheet colour (dense enough to keep text AA).
                Builds without expo-blur's native side, and Android, stay solid. */}
            {NativeBlur && (
              <>
                <NativeBlur
                  intensity={60}
                  tint={colorScheme === "dark" ? "systemThickMaterialDark" : "systemThickMaterialLight"}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: withAlpha(colors.raised!, 0.72) }} />
              </>
            )}
            <GestureDetector gesture={panGesture}>
              <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }} hitSlop={{ top: 12, bottom: 12, left: 48, right: 48 }}>
                {/* Kept in layout while locked so the content doesn't jump when the grabber returns. */}
                <View style={{ width: 36, height: 5, borderRadius: 999, backgroundColor: withAlpha(colors["text-3"]!, dismissible ? 0.35 : 0) }} />
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
