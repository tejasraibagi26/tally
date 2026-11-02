import type { ReactNode } from "react";
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

export type BlurTint = "dark" | "light" | "default" | "systemThickMaterialDark" | "systemThickMaterialLight";
export type BlurComponent = (props: { intensity?: number; tint?: BlurTint; style?: object; children?: ReactNode }) => ReactNode;

// expo-blur (UIBlurEffect), iOS only, checked once. It's loaded only when
// this build has its native side, since an over-the-air update can reach a
// build made before it was added (mobile v2.1.4). Null means: draw solid.
export const NativeBlur: BlurComponent | null = (() => {
  if (Platform.OS !== "ios" || !requireOptionalNativeModule("ExpoBlur")) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("expo-blur") as { BlurView: BlurComponent }).BlurView;
  } catch {
    return null;
  }
})();

// One glass recipe for every sheet -- ui/Sheet.tsx (expo-blur underneath)
// and the native More sheet (iOS's own glass underneath): a wash of
// `raised` over the blur, dense enough that what's behind reads as a soft
// hint rather than stains and captions stay legible on any backdrop, and
// cards on the glass at a lighter alpha so they belong to it.
export const SHEET_WASH = 0.6;
export const SHEET_CARD = 0.75;

// Native (react-native-screens) formSheet options for the same floating
// glass on iOS 26: a radius concentric with the display (iOS applies it to
// all four corners; unset, the sheet stops floating), and clear content so
// the system glass shows -- the screen paints SHEET_WASH over it itself.
export const GLASS_FORM_SHEET_IOS = {
  presentation: "formSheet" as const,
  sheetGrabberVisible: true,
  sheetCornerRadius: 44,
  sheetExpandsWhenScrolledToEdge: false,
  contentStyle: { backgroundColor: "transparent" },
};
