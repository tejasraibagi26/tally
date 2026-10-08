import { useEffect } from "react";
import Svg, { Line } from "react-native-svg";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const AnimatedLine = Animated.createAnimatedComponent(Line);

// The brand mark's strokes (same coordinates as web's components/Logo.tsx
// LogoMark): four verticals, then the crossing slash. react-native-svg has no
// pathLength, so each carries its real length for the dash animation.
const STROKES = [
  { x1: 7, y1: 6, x2: 7, y2: 18, len: 12 },
  { x1: 10, y1: 6, x2: 10, y2: 18, len: 12 },
  { x1: 13, y1: 6, x2: 13, y2: 18, len: 12 },
  { x1: 16, y1: 6, x2: 16, y2: 18, len: 12 },
  { x1: 5, y1: 17.5, x2: 18.5, y2: 5.5, len: 18.07 },
] as const;

// Where in the loop each stroke inks in -- the same timeline as web's
// tally-1..5 keyframes: strokes 10% apart, the slash at 44–56%, all fade
// out over 78–90%, blank until the loop restarts.
const WINDOWS: readonly (readonly [number, number])[] = [
  [0, 0.09],
  [0.1, 0.19],
  [0.2, 0.29],
  [0.3, 0.39],
  [0.44, 0.56],
];

function Stroke({ index, progress, color, still }: { index: number; progress: SharedValue<number>; color: string; still: boolean }) {
  const s = STROKES[index]!;
  const [from, to] = WINDOWS[index]!;
  const animatedProps = useAnimatedProps(() => {
    if (still) return { strokeDashoffset: 0, strokeOpacity: 1 };
    const p = progress.value;
    const drawn = Easing.inOut(Easing.cubic)(interpolate(p, [from, to], [0, 1], Extrapolation.CLAMP));
    const fade = interpolate(p, [0.78, 0.9], [1, 0], Extrapolation.CLAMP);
    return { strokeDashoffset: s.len * (1 - drawn), strokeOpacity: p < from ? 0 : fade };
  });
  return (
    <AnimatedLine
      animatedProps={animatedProps}
      x1={s.x1}
      y1={s.y1}
      x2={s.x2}
      y2={s.y2}
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeDasharray={[s.len, s.len]}
    />
  );
}

/**
 * The tally mark writing itself -- the progress indicator in a 40pt header
 * tile (ProgressSheet). Header-tile size only: below ~24pt it reads as two
 * bars, so buttons keep ActivityIndicator. `slow` stretches the loop to 3.2s
 * for the "taking longer than usual" phase. Reduce Motion shows the finished
 * mark, still.
 */
export function TallyLoader({ color, size = 24, slow = false }: { color: string; size?: number; slow?: boolean }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: slow ? 3200 : 2400, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [slow, reduceMotion, progress]);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {STROKES.map((_, i) => (
        <Stroke key={i} index={i} progress={progress} color={color} still={reduceMotion} />
      ))}
    </Svg>
  );
}
