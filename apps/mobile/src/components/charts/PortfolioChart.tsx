import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, View } from "react-native";
import Svg, { Defs, LinearGradient, Line, Path, Stop, Circle } from "react-native-svg";
import type { HistoryPoint } from "@tally/core/investments";
import { useThemeColors } from "@/theme/useThemeColors";

/**
 * Portfolio value (line + area) with money-in as a dashed step line under
 * it -- the gap is growth. Drawn directly with react-native-svg so the
 * scrub gesture is a plain PanResponder over a known x-scale (the same
 * approach the Overview chart settled on after gifted-charts' pointer
 * callbacks proved unreliable on release).
 */
export function PortfolioChart({
  points,
  height = 150,
  onScrub,
  onScrubbingChange,
}: {
  points: HistoryPoint[];
  height?: number;
  /** Index under the finger, or null when released. */
  onScrub: (index: number | null) => void;
  /** Lets the parent lock its ScrollView while a finger is on the chart. */
  onScrubbingChange: (scrubbing: boolean) => void;
}) {
  const colors = useThemeColors();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number | null>(null);
  const pageXRef = useRef(0);

  const geo = useMemo(() => {
    if (width <= 0 || points.length < 2) return null;
    const all = points.flatMap((p) => [p.value, p.invested]);
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.08 || Math.abs(max) * 0.02 || 1;
    const lo = min - pad;
    const hi = max + pad * 0.5;
    const top = 6;
    const h = height - top - 2;
    const x = (i: number) => (i / (points.length - 1)) * width;
    const y = (v: number) => top + h * (1 - (v - lo) / (hi - lo));
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    const area = `${line} L${width.toFixed(1)},${height} L0,${height} Z`;
    let step = `M0,${y(points[0]!.invested).toFixed(1)}`;
    for (let i = 1; i < points.length; i++) {
      step += ` L${x(i).toFixed(1)},${y(points[i - 1]!.invested).toFixed(1)}`;
      if (points[i]!.invested !== points[i - 1]!.invested) step += ` L${x(i).toFixed(1)},${y(points[i]!.invested).toFixed(1)}`;
    }
    return { x, y, line, area, step };
  }, [points, width, height]);

  // The PanResponder is created once (refs only touched inside its event
  // handlers, never during render); the handlers read the latest width,
  // point count and callbacks through this ref.
  const live = useRef({ width, count: points.length, onScrub, onScrubbingChange });
  useEffect(() => {
    live.current = { width, count: points.length, onScrub, onScrubbingChange };
  });

  // The lint can't tell the refs below are only read inside gesture
  // handlers (event time), not while rendering.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() => {
    const scrubAt = (localX: number) => {
      const { width: w, count } = live.current;
      if (w <= 0 || count < 2) return;
      const i = Math.max(0, Math.min(count - 1, Math.round((Math.max(0, Math.min(w, localX)) / w) * (count - 1))));
      setIndex(i);
      live.current.onScrub(i);
    };
    const end = () => {
      setIndex(null);
      live.current.onScrub(null);
      live.current.onScrubbingChange(false);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        live.current.onScrubbingChange(true);
        pageXRef.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
        scrubAt(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (_evt, g) => scrubAt(g.moveX - pageXRef.current),
      onPanResponderRelease: end,
      onPanResponderTerminate: end,
    });
  });

  const last = points.length - 1;
  const at = index ?? last;
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...responder.panHandlers}>
      {geo && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="pf" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.brand} stopOpacity={0.22} />
              <Stop offset="1" stopColor={colors.brand} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path d={geo.area} fill="url(#pf)" />
          <Path d={geo.step} fill="none" stroke={colors["text-3"]} strokeWidth={1.5} strokeDasharray="4 4" />
          <Path d={geo.line} fill="none" stroke={colors.brand} strokeWidth={2} strokeLinejoin="round" />
          {index != null && <Line x1={geo.x(index)} x2={geo.x(index)} y1={0} y2={height} stroke={colors["text-3"]} strokeWidth={1} strokeDasharray="2 3" />}
          {index != null && <Circle cx={geo.x(index)} cy={geo.y(points[index]!.invested)} r={3} fill={colors["text-3"]} stroke={colors.surface} strokeWidth={1.5} />}
          <Circle cx={geo.x(at)} cy={geo.y(points[at]!.value)} r={4} fill={colors.brand} stroke={colors.surface} strokeWidth={2} />
        </Svg>
      )}
    </View>
  );
}
