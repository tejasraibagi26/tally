import { Platform } from "react-native";

/**
 * The More sheet's (app/more.tsx) own height at a 1.0 font scale, excluding
 * the bottom safe-area inset: top padding + title, two caption+card groups
 * (48pt rows plus hairlines), the build line and bottom padding. Update it if
 * rows are added or removed: each row is 48pt plus a 1pt hairline. 464 =
 * 415 + 49 for Credit cards (mobile v1.27.1).
 */
export const MORE_SHEET_CONTENT_HEIGHT = 464;

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
