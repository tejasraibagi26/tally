import { useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, useColorScheme as useSystemColorScheme } from "react-native";
import Svg, { Line } from "react-native-svg";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const AnimatedLine = Animated.createAnimatedComponent(Line);

// Same geometry as the brand mark (web components/Logo.tsx, and the native
// splash-icon.png it was rendered from): four strokes, then the fifth
// crossing them, on a 24-unit grid. Drawn at the native splash's 76pt
// imageWidth so the hand-off from the native splash lands in the same spot.
const STROKES = [
  { x1: 7, y1: 6, x2: 7, y2: 18 },
  { x1: 10, y1: 6, x2: 10, y2: 18 },
  { x1: 13, y1: 6, x2: 13, y2: 18 },
  { x1: 16, y1: 6, x2: 16, y2: 18 },
  // The cross stroke, drawn bottom-left to top-right like a pen would.
  { x1: 5, y1: 17.5, x2: 18.5, y2: 5.5 },
] as const;
const LOGO_SIZE = 76;
const STROKE_WIDTH = 2;

// Timing: each upright draws in 220ms, 130ms apart; a short beat, then the
// slash in 320ms. ~1.2s to a finished mark.
const UPRIGHT_MS = 220;
const UPRIGHT_GAP_MS = 130;
const CROSS_DELAY_MS = 3 * UPRIGHT_GAP_MS + UPRIGHT_MS + 140;
const CROSS_MS = 320;
export const BOOT_DRAW_MS = CROSS_DELAY_MS + CROSS_MS;
const FADE_OUT_MS = 320;

// Native splash colors (app.json expo-splash-screen + splash-icon*.png), so
// there's no color jump at the hand-off.
const PALETTE = {
  light: { bg: "#F5F4F0", ink: "#14513F", text: "#4D4B45" },
  dark: { bg: "#000000", ink: "#4FB394", text: "#B3B1A8" },
};

function strokeLength(s: (typeof STROKES)[number]): number {
  return Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
}

function Stroke({ stroke, progress, color }: { stroke: (typeof STROKES)[number]; progress: SharedValue<number>; color: string }) {
  const length = strokeLength(stroke);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.value),
    // A zero-length dash still paints its round caps as a dot -- keep the
    // stroke invisible until it actually starts drawing.
    strokeOpacity: progress.value > 0.001 ? 1 : 0,
  }));
  return (
    <AnimatedLine
      {...stroke}
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeDasharray={[length, length]}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Cold-start loading screen: the tally mark drawing itself stroke by stroke,
 * then "Tally" fading in. Stays up (with a slow breathe once drawn) until
 * `ready`, never shorter than one full draw, then fades out and calls
 * `onDone` so the parent can unmount it. Respects Reduce Motion: the mark
 * shows fully drawn and only the fade-out runs.
 */
export function BootSplash({ ready, showWordmark, onDone }: { ready: boolean; showWordmark: boolean; onDone: () => void }) {
  const scheme = useSystemColorScheme() === "dark" ? "dark" : "light";
  const palette = PALETTE[scheme];

  const p0 = useSharedValue(0);
  const p1 = useSharedValue(0);
  const p2 = useSharedValue(0);
  const p3 = useSharedValue(0);
  const p4 = useSharedValue(0);
  const progress = [p0, p1, p2, p3, p4];
  const wordmark = useSharedValue(0);
  const breathe = useSharedValue(1);
  const exit = useSharedValue(0);

  const [drawn, setDrawn] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion === null) return;
    if (reduceMotion) {
      progress.forEach((p) => (p.value = 1));
      wordmark.value = 1;
      setDrawn(true);
      return;
    }
    const ease = Easing.out(Easing.cubic);
    for (let i = 0; i < 4; i++) {
      progress[i]!.value = withDelay(i * UPRIGHT_GAP_MS, withTiming(1, { duration: UPRIGHT_MS, easing: ease }));
    }
    p4.value = withDelay(
      CROSS_DELAY_MS,
      withTiming(1, { duration: CROSS_MS, easing: Easing.inOut(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setDrawn)(true);
      }),
    );
    wordmark.value = withDelay(BOOT_DRAW_MS - 80, withTiming(1, { duration: 360, easing: ease }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Still loading once the mark is finished: a slow breathe so the screen
  // doesn't look frozen.
  useEffect(() => {
    if (!drawn || ready || reduceMotion) return;
    breathe.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 700, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) })),
      -1,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, ready, reduceMotion]);

  useEffect(() => {
    if (!drawn || !ready) return;
    breathe.value = withTiming(1, { duration: 160 });
    exit.value = withTiming(1, { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawn, ready]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value * (1 + exit.value * 0.08) }],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [{ translateY: (1 - wordmark.value) * 6 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, alignItems: "center", justifyContent: "center" }, containerStyle]}
      pointerEvents={ready && drawn ? "none" : "auto"}
      accessible
      accessibilityLabel="Loading Tally"
      accessibilityRole="progressbar"
    >
      <Animated.View style={markStyle}>
        <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 24 24" fill="none">
          {STROKES.map((s, i) => (
            <Stroke key={i} stroke={s} progress={progress[i]!} color={palette.ink} />
          ))}
        </Svg>
      </Animated.View>
      {/* Absolutely placed below the mark so the mark itself stays dead
          center, exactly where the native splash put it. */}
      {showWordmark && (
        <Animated.View style={[{ position: "absolute", top: "50%", marginTop: LOGO_SIZE / 2 + 14 }, wordmarkStyle]}>
          <Text style={{ fontFamily: "InstrumentSerif", fontSize: 30, color: palette.text, letterSpacing: 0.2 }}>Tally</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

/**
 * The finished mark on the splash background, no animation: covers the app
 * while it isn't in the foreground (AuthContext's isCovered) so the iOS app
 * switcher snapshot doesn't show balances, without asking for Face ID.
 */
export function PrivacyCover() {
  const scheme = useSystemColorScheme() === "dark" ? "dark" : "light";
  const palette = PALETTE[scheme];
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, alignItems: "center", justifyContent: "center" }]} pointerEvents="none">
      <Svg width={LOGO_SIZE} height={LOGO_SIZE} viewBox="0 0 24 24" fill="none">
        {STROKES.map((s, i) => (
          <Line key={i} {...s} stroke={palette.ink} strokeWidth={STROKE_WIDTH} strokeLinecap="round" />
        ))}
      </Svg>
    </Animated.View>
  );
}
