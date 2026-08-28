// Re-exports the same light/dark hex maps NativeWind's `dark:` variant uses
// (tailwind.config.js) for code that needs a raw color value rather than a
// className — chart series (react-native-gifted-charts takes hex strings,
// not classNames), SVG icon `stroke`/`fill`, and status-badge colors.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tailwindConfig = require("../../tailwind.config.js") as {
  lightColors: Record<string, string>;
  darkColors: Record<string, string>;
};

export const lightColors = tailwindConfig.lightColors;
export const darkColors = tailwindConfig.darkColors;

export type ColorToken = keyof typeof lightColors;

export function colorsFor(scheme: "light" | "dark"): Record<string, string> {
  return scheme === "dark" ? darkColors : lightColors;
}

/** DESIGN.md §7.1 -- fixed order, never cycled, never reused as a status color. */
export const chartSeries = {
  light: ["#1baf7a", "#eb6834", "#2a78d6", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#199e70", "#d95926", "#3987e5", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};
