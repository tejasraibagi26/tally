import { View, type ViewProps } from "react-native";

// MOBILE_DESIGN.md §3.4 originally called for a soft drop shadow here; the
// shadow read as too harsh on Android (elevation renders a much more
// pronounced, less blurred edge than iOS's shadowRadius at the same nominal
// value) and was dropped in favor of relying on bg-surface's contrast
// against bg-canvas alone for separation, same as dark mode already did.
export function Card({ className, style, ...props }: ViewProps) {
  return <View className={`bg-surface rounded-card ${className ?? ""}`} style={style} {...props} />;
}
