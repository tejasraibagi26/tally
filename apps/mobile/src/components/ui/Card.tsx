import { Platform, View, type ViewProps } from "react-native";
import { useThemeColors } from "@/theme/useThemeColors";

// MOBILE_DESIGN.md §3.4 originally called for a soft drop shadow here; the
// shadow read as too harsh on Android (elevation renders a much more
// pronounced, less blurred edge than iOS's shadowRadius at the same nominal
// value) and was dropped in favor of relying on bg-surface's contrast
// against bg-canvas alone for separation, same as dark mode already did.
//
// Tally Pop brings an edge back as a sticker: border-card's ink outline plus
// a hard offset shadow with no blur. iOS draws it with the shadow* props.
// Android's elevation can't offset a shadow, so it uses boxShadow (React
// Native 0.76+, New Architecture), which Android draws from version 9 (API
// 28); below that the card keeps the outline alone.
export function useStickerShadow() {
  const colors = useThemeColors();
  if (Platform.OS === "ios") return { shadowColor: colors["ink-shadow"], shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0 };
  if (Platform.OS === "android") return { boxShadow: `4px 4px 0px 0px ${colors["ink-shadow"]}` };
  return null;
}

export function Card({ className, style, ...props }: ViewProps) {
  const sticker = useStickerShadow();
  return <View className={`bg-surface rounded-card border-card border-ink ${className ?? ""}`} style={[sticker, style]} {...props} />;
}
