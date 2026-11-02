import { Platform, View, type ViewProps } from "react-native";
import { useColorScheme } from "nativewind";
import { useThemeColors } from "@/theme/useThemeColors";

// MOBILE_DESIGN.md §3.4 originally called for a soft drop shadow here; the
// shadow read as too harsh on Android (elevation renders a much more
// pronounced, less blurred edge than iOS's shadowRadius at the same nominal
// value) and was dropped in favor of relying on bg-surface's contrast
// against bg-canvas alone for separation, same as dark mode already did.
//
// Tally Pop then brought an edge back as a sticker (an ink outline plus a
// hard offset shadow). Pop Calm (mobile v2.18.0) replaces the sticker:
// light cards lift off the canvas on a soft, low-opacity shadow; dark cards
// get a 1px hairline in --border instead, since a shadow vanishes on a
// near-black canvas. Android draws the shadow with boxShadow (React Native
// 0.76+, New Architecture, Android 9+) rather than elevation, which can't
// be made this soft; below API 28 the card relies on the surface contrast.
// The name stays so every card-like surface keeps sharing one recipe; in
// dark it returns the hairline border, so callers get both from one hook.
export function useStickerShadow() {
  const { colorScheme } = useColorScheme();
  const colors = useThemeColors();
  if (colorScheme === "dark") return { borderWidth: 1, borderColor: colors.border };
  if (Platform.OS === "ios") return { shadowColor: "#1D1B2F", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 10 };
  if (Platform.OS === "android") return { boxShadow: "0px 1px 2px 0px rgba(29, 27, 47, 0.06), 0px 6px 20px 0px rgba(29, 27, 47, 0.05)" };
  return null;
}

export function Card({ className, style, ...props }: ViewProps) {
  const edge = useStickerShadow();
  return <View className={`bg-surface rounded-card ${className ?? ""}`} style={[edge, style]} {...props} />;
}
