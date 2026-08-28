import { useWindowDimensions } from "react-native";

// Most of this app's font sizes were tuned against a ~390pt-wide iPhone
// (14/15/16, non-Plus/Max). On a physically larger screen the same point
// size reads smaller relative to the display, so scale by how much wider
// the current device is than that baseline -- clamped so a tablet-width
// window doesn't blow text up unreasonably, or a mini-width one shrink it
// too far. RN's Text already multiplies the resolved fontSize by the OS's
// accessibility text-size setting (PixelRatio.getFontScale(), applied via
// allowFontScaling -- on by default, left untouched here), so this only
// covers the screen-size half; the two compose rather than conflict.
const BASELINE_WIDTH = 390;
const MIN_SCALE = 0.92;
const MAX_SCALE = 1.2;

export function useResponsiveFontScale(): number {
  const { width } = useWindowDimensions();
  const raw = width / BASELINE_WIDTH;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw));
}

/** `const rf = useRF(); ... style={{ fontSize: rf(15) }}` */
export function useRF(): (size: number) => number {
  const scale = useResponsiveFontScale();
  return (size: number) => Math.round(size * scale * 10) / 10;
}
