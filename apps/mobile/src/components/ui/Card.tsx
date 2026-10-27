import { Platform, View, type ViewProps } from "react-native";
import { useUiLook } from "@/lib/UiLookContext";
import { useThemeColors } from "@/theme/useThemeColors";

// MOBILE_DESIGN.md §3.4 originally called for a soft drop shadow here; the
// shadow read as too harsh on Android (elevation renders a much more
// pronounced, less blurred edge than iOS's shadowRadius at the same nominal
// value) and was dropped in favor of relying on bg-surface's contrast
// against bg-canvas alone for separation, same as dark mode already did.
//
// Tally Pop brings an edge back as a sticker: border-card's ink outline
// (0px in the classic look) plus, on iOS, a hard offset shadow with no blur.
// Android's elevation can't draw an offset, so it keeps the outline alone.
export function useStickerShadow() {
  const { pop } = useUiLook();
  const colors = useThemeColors();
  return pop && Platform.OS === "ios" ? { shadowColor: colors["ink-shadow"], shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 } : null;
}

export function Card({ className, style, ...props }: ViewProps) {
  const sticker = useStickerShadow();
  return <View className={`bg-surface rounded-card border-card border-ink ${className ?? ""}`} style={[sticker, style]} {...props} />;
}
