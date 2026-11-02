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
