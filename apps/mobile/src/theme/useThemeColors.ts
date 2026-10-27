import { createContext, useContext } from "react";
import { useColorScheme } from "nativewind";
import { colorsFor } from "@/theme/colors";
import { popDarkColors, popLightColors } from "@/theme/pop";
import { useUiLook } from "@/lib/UiLookContext";

// For raw hex values RN props require directly (icon color/fill, Switch
// trackColor, chart series, shadowColor) rather than a className -- those
// can't pick up global.css's CSS-variable dark-mode swap the way `bg-canvas`
// etc. do automatically. nativewind's useColorScheme already tracks
// Appearance and defaults to "system", so this stays in sync for free.
//
// Follows the Tally Pop flag too (lib/UiLookContext.tsx): its palette adds
// ink, marigold and hero-* tokens that only exist there.
export function useThemeColors() {
  const { colorScheme } = useColorScheme();
  const { pop } = useUiLook();
  const override = useContext(ThemeColorsOverride);
  const dark = colorScheme === "dark";
  const base = pop ? (dark ? popDarkColors : popLightColors) : colorsFor(dark ? "dark" : "light");
  return override ? { ...base, ...override } : base;
}

/**
 * Re-declares some tokens for a subtree whose ground isn't a normal surface
 * (Tally Pop's solid net-worth card, components/overview/PopOverview.tsx).
 * Pair it with the same values as NativeWind vars() so classNames follow too.
 */
export const ThemeColorsOverride = createContext<Record<string, string> | null>(null);
