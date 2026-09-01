import { useEffect, useMemo, useRef } from "react";
import { Animated } from "react-native";
import Svg, { Rect, Circle, G } from "react-native-svg";
import { useThemeColors } from "@/theme/useThemeColors";

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DAY_COLS = [30, 40, 50, 60, 70, 80, 90];
const DAY_ROWS = [52, 64];
const HIGHLIGHTED_DAY = { cx: 60, cy: 64 };

const SPARKLES = [
  { cx: 12, cy: 22, duration: 3600, delay: 0 },
  { cx: 109, cy: 32, duration: 4200, delay: 700 },
  { cx: 100, cy: 80, duration: 3900, delay: 1400 },
];

/**
 * RN port of apps/web/components/transactions/EmptyPeriodIllustration.tsx —
 * same calendar-checked-a-date-and-found-nothing scene. react-native-svg
 * components take rotation/r/opacity as plain numeric props (not a `style`
 * transform), so Animated values are passed directly to those props via
 * Animated.createAnimatedComponent rather than through style — all driven
 * off the JS thread (useNativeDriver: false), since none of these are
 * native-driver-eligible style properties on a host view.
 */
export function EmptyPeriodIllustration() {
  const colors = useThemeColors();
  const tilt = useRef(new Animated.Value(-1)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const sparkleValues = useMemo(() => SPARKLES.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    const tiltLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(tilt, { toValue: 1, duration: 2500, useNativeDriver: false }),
        Animated.timing(tilt, { toValue: -1, duration: 2500, useNativeDriver: false }),
      ]),
    );
    tiltLoop.start();

    const ringLoop = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 2200, useNativeDriver: false }));
    ringLoop.start();

    const sparkleLoops = sparkleValues.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(SPARKLES[i]!.delay),
          Animated.timing(v, { toValue: 1, duration: SPARKLES[i]!.duration, useNativeDriver: false }),
        ]),
      ),
    );
    sparkleLoops.forEach((l) => l.start());

    return () => {
      tiltLoop.stop();
      ringLoop.stop();
      sparkleLoops.forEach((l) => l.stop());
      ring.setValue(0);
    };
  }, [tilt, ring, sparkleValues]);

  const rotation = tilt.interpolate({ inputRange: [-1, 1], outputRange: [-2, 2] });
  const ringRadius = ring.interpolate({ inputRange: [0, 1], outputRange: [4, 10] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] });

  return (
    <Svg width={112} height={90} viewBox="0 0 120 96">
      {SPARKLES.map((s, i) => {
        const v = sparkleValues[i]!;
        const cy = v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [s.cy, s.cy, s.cy - 10] });
        const opacity = v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.9, 0] });
        return <AnimatedCircle key={i} cx={s.cx} cy={cy} r={2} fill={colors["brand-border"]} opacity={opacity} />;
      })}
      <AnimatedG rotation={rotation} origin="60,55">
        <Rect x={44} y={14} width={6} height={14} rx={3} fill={colors["border-strong"]} />
        <Rect x={70} y={14} width={6} height={14} rx={3} fill={colors["border-strong"]} />
        <Rect x={18} y={24} width={84} height={62} rx={12} fill={colors.surface} stroke={colors["border-strong"]} strokeWidth={2} />
        <Rect x={30} y={34} width={60} height={8} rx={4} fill={colors.brand} />
        {DAY_ROWS.flatMap((cy) =>
          DAY_COLS.filter((cx) => !(cx === HIGHLIGHTED_DAY.cx && cy === HIGHLIGHTED_DAY.cy)).map((cx) => (
            <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.2} fill={colors.border} />
          )),
        )}
        <Circle cx={HIGHLIGHTED_DAY.cx} cy={HIGHLIGHTED_DAY.cy} r={3.5} fill={colors.brand} />
        <AnimatedCircle
          cx={HIGHLIGHTED_DAY.cx}
          cy={HIGHLIGHTED_DAY.cy}
          r={ringRadius}
          fill="none"
          stroke={colors.brand}
          strokeWidth={1.5}
          opacity={ringOpacity}
        />
      </AnimatedG>
    </Svg>
  );
}
