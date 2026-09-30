import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Height of Android's JS tab bar above the system navigation inset -- the
// bar itself is ANDROID_TAB_BAR_BASE_HEIGHT + insets.bottom tall (see
// (tabs)/_layout.tsx, which sizes it from this same constant).
export const ANDROID_TAB_BAR_BASE_HEIGHT = 62;

// How much bottom space a tab screen's scroll content needs so its last row
// can scroll clear of the tab bar. Already INCLUDES the bottom safe-area
// inset on both platforms -- never add insets.bottom on top of it (see the
// double-counting note in memory / MOBILE_DESIGN.md).
//
// iOS: NativeTabsView.ios embeds each tab's content as a child of the real
// UITabBarController, so UIKit registers the floating "Liquid Glass" pill's
// actual footprint (its height + the margin above the home indicator) as
// additionalSafeAreaInsets on that hierarchy -- react-native-safe-area-
// context's useSafeAreaInsets().bottom already reflects that, no manual
// buffer on top of it needed. (Two earlier wrong guesses here: adding a
// +60 buffer on top of insets.bottom left a large dead zone above the
// pill; dropping insets.bottom entirely for a flat 24 undershot and left
// content clipped behind it. insets.bottom alone is the actual pill
// footprint.)
//
// Android: the JS tab bar is translucent and floats over the screen
// (position: "absolute" in (tabs)/_layout.tsx), so it reserves no layout
// space of its own anymore -- content needs the bar's full height.
export function useTabBarBottomClearance() {
  const insets = useSafeAreaInsets();
  return Platform.OS === "ios" ? insets.bottom : ANDROID_TAB_BAR_BASE_HEIGHT + insets.bottom;
}
