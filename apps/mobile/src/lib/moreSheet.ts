import { Platform } from "react-native";

/**
 * The More sheet's (app/more.tsx) own height at a 1.0 font scale, excluding
 * the bottom safe-area inset: top padding + title, two caption+card groups
 * (48pt rows plus hairlines), the build line and bottom padding. Update it if
 * rows are added or removed: each row is 48pt plus a 1pt hairline. 464 =
 * 415 + 49 for Credit cards (mobile v1.27.1); + 49 for Tags (mobile
 * v2.6.0). Year in review had a row from v2.5.0 to v2.7.1; it's reached
 * from Overview's January strip now. 562 = 513 + 49 for Forecast
 * (mobile v2.8.0). 645 = 562 + 34 for Figtree's taller line box (the
 * title and captions; mobile v2.0.0) + 49 for Year-end goal. 596 = 645 -
 * 49: Year-end goal and Early retirement became one Goals row (v2.12.0).
 * 645 = 596 + 49 for Loans (v2.13.0). 648 = 645 + 3 for the title going
 * from 16 to 18pt, left-aligned (v2.16.2).
 */
export const MORE_SHEET_CONTENT_HEIGHT = 648;

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
export function moreSheetDetent(opts: { windowHeight: number; fontScale: number; bottomInset: number }): number {
  const content = MORE_SHEET_CONTENT_HEIGHT * opts.fontScale;
  const height = Platform.OS === "ios" ? (content + opts.bottomInset) * IOS_CALIBRATION : content + opts.bottomInset;
  return Math.min(0.9, height / opts.windowHeight);
}
