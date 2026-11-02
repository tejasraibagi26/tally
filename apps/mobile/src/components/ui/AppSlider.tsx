import { useRef, useState } from "react";
import { PanResponder, Platform, View, type LayoutChangeEvent } from "react-native";
import { useThemeColors } from "@/theme/useThemeColors";

const HEIGHT = 36; // the touch row
const TRACK = 10;
const THUMB = 24;

/**
 * Tally Pop's slider, drawn in JS so it matches the theme on both
 * platforms (the native SwiftUI / Material sliders it replaced, mobile
 * v2.15.1, wore the system blue and Material's purple): a sunken track in
 * the ink outline, the filled part in brand, a marigold thumb with a small
 * hard shadow. Tap anywhere on the track to jump there, drag to adjust.
 * `onSlidingChange` lets a parent ScrollView stop scrolling mid-drag.
 * VoiceOver/TalkBack adjust it one step per swipe.
 */
export function AppSlider({
  value,
  onValueChange,
  min,
  max,
  step,
  onSlidingChange,
  accessibilityLabel,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  onSlidingChange?: (sliding: boolean) => void;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const [sliding, setSliding] = useState(false);
  // The responder is made once; it reads the latest props through this ref.
  const live = useRef({ value, onValueChange, min, max, step, width, onSlidingChange, startX: 0 });
  live.current = { ...live.current, value, onValueChange, min, max, step, width, onSlidingChange };

  const span = max - min || 1;
  const frac = Math.min(1, Math.max(0, (value - min) / span));
  const usable = Math.max(0, width - THUMB);
  const thumbX = frac * usable;

  function snap(v: number) {
    const s = live.current.step;
    const { min: lo, max: hi } = live.current;
    const stepped = s && s > 0 ? lo + Math.round((v - lo) / s) * s : v;
    // Float steps (0.0025) drift; keep 6 places.
    return Math.min(hi, Math.max(lo, Math.round(stepped * 1e6) / 1e6));
  }
  function setFromX(x: number) {
    const { width: w, min: lo, max: hi, value: current, onValueChange: emit } = live.current;
    const room = Math.max(1, w - THUMB);
    const next = snap(lo + (Math.min(room, Math.max(0, x - THUMB / 2)) / room) * (hi - lo));
    if (next !== current) emit(next);
  }
  function end() {
    setSliding(false);
    live.current.onSlidingChange?.(false);
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        live.current.startX = e.nativeEvent.locationX;
        setSliding(true);
        live.current.onSlidingChange?.(true);
        setFromX(live.current.startX);
      },
      onPanResponderMove: (_e, g) => setFromX(live.current.startX + g.dx),
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    }),
  ).current;

  const stepBy = step && step > 0 ? step : span / 100;
  const shadow =
    Platform.OS === "ios"
      ? { shadowColor: colors["ink-shadow"], shadowOffset: { width: 2, height: 2 }, shadowOpacity: 1, shadowRadius: 0 }
      : { boxShadow: `2px 2px 0px 0px ${colors["ink-shadow"]}` };

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: HEIGHT, justifyContent: "center" }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const next = snap(value + (e.nativeEvent.actionName === "increment" ? stepBy : -stepBy));
        if (next !== value) onValueChange(next);
      }}
      {...responder.panHandlers}
    >
      <View
        pointerEvents="none"
        style={{ height: TRACK, borderRadius: TRACK, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.sunken, overflow: "hidden", marginHorizontal: 2 }}
      >
        <View style={{ height: "100%", width: thumbX + THUMB / 2, backgroundColor: colors.brand }} />
      </View>
      <View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            left: thumbX,
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            borderWidth: 2,
            borderColor: colors.ink,
            backgroundColor: colors.marigold,
            transform: [{ scale: sliding ? 1.12 : 1 }],
          },
          shadow,
        ]}
      />
    </View>
  );
}
