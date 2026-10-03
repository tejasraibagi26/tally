import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ANDROID_TAB_BAR_GAP, ANDROID_TAB_BAR_HEIGHT } from "@/components/AndroidTabBar";

// NativeTabsView.ios embeds each tab's content as a child of the real
// UITabBarController, so UIKit registers the floating "Liquid Glass" pill's
// actual footprint (its height + the margin above the home indicator) as
// additionalSafeAreaInsets on that hierarchy -- react-native-safe-area-
// context's useSafeAreaInsets().bottom already reflects that, no manual
// buffer on top of it needed. (Two earlier wrong guesses here: adding a
// +60 buffer on top of insets.bottom left a large dead zone above the
// pill; dropping insets.bottom entirely for a flat 24 undershot and left
// content clipped behind it. insets.bottom alone is the actual pill
// footprint.) Android's custom bar (components/AndroidTabBar.tsx) floats
// and reserves no layout space, so its full footprint is added here.
export function useTabBarBottomClearance() {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "ios") return insets.bottom;
  return insets.bottom + ANDROID_TAB_BAR_GAP + ANDROID_TAB_BAR_HEIGHT;
}
