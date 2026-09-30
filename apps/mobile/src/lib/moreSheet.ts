/**
 * The More sheet's (app/more.tsx) own height at a 1.0 font scale, excluding the bottom safe-area
 * inset: top padding + title, two caption+card groups (48pt rows plus
 * hairlines), the build line and bottom padding. app/_layout.tsx turns it into
 * the sheet's detent, because a fixed fraction of the screen left dead space
 * on taller iPhones and "fitToContents" leaves a gap (see app/_layout.tsx).
 * Update it if rows are added or removed.
 */
export const MORE_SHEET_CONTENT_HEIGHT = 415;
