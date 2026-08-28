import { useColorScheme } from "nativewind";
import { colorsFor } from "@/theme/colors";

// For raw hex values RN props require directly (icon color/fill, Switch
// trackColor, chart series, shadowColor) rather than a className -- those
// can't pick up global.css's CSS-variable dark-mode swap the way `bg-canvas`
// etc. do automatically. nativewind's useColorScheme already tracks
// Appearance and defaults to "system", so this stays in sync for free.
export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  return colorsFor(colorScheme === "dark" ? "dark" : "light");
}
