import { Platform } from "react-native";

/**
 * The More sheet's (app/more.tsx) own height at a 1.0 font scale, excluding
 * the bottom safe-area inset: top padding + title, two caption+card groups
 * (48pt rows plus hairlines), the build line and bottom padding. Update it if
 * rows are added or removed: each row is 48pt plus a 1pt hairline. 464 =
 * 415 + 49 for Credit cards (mobile v1.27.1); + 49 for Tags (mobile
 * v2.6.0). Year in review had a row from v2.5.0 to v2.7.1; it's reached
 * from Overview's January strip now. 562 = 513 + 49 for Forecast
 * (mobile v2.8.0).
 */
export const MORE_SHEET_CONTENT_HEIGHT = 562;

/**
 * Extra height in the Tally Pop look: Figtree's line box is taller than
 * Inter's at the same size, so the title and captions grow and the build
 * line fell off the bottom (mobile v2.0.0), plus the Pop-only "Year-end
 * goal" row (48pt + a 1pt hairline).
 */
export const MORE_SHEET_POP_EXTRA = 34 + 49;

/**
 * On iOS 26 the form sheet floats above the home indicator, so no inset is
 * added, and a detent fraction comes out taller than fraction x window
 * height. Calibrated from a device screenshot (mobile v1.11.1): at
 * (415 * scale + inset) / height the content ended at ~79% of the sheet, so
 * iOS uses 0.79 of that height.
 */
const IOS_CALIBRATION = 0.79;

/**
 * The detent for the More sheet. An explicit fraction, because
 * "fitToContents" leaves a gap (see app/_layout.tsx).
 */
export function moreSheetDetent(opts: { windowHeight: number; fontScale: number; bottomInset: number; pop?: boolean }): number {
  const content = (MORE_SHEET_CONTENT_HEIGHT + (opts.pop ? MORE_SHEET_POP_EXTRA : 0)) * opts.fontScale;
  const height = Platform.OS === "ios" ? (content + opts.bottomInset) * IOS_CALIBRATION : content + opts.bottomInset;
  return Math.min(0.9, height / opts.windowHeight);
}
