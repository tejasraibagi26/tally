import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// NativeTabsView.ios embeds each tab's content as a child of the real
// UITabBarController, so UIKit registers the floating "Liquid Glass" pill's
// actual footprint (its height + the margin above the home indicator) as
// additionalSafeAreaInsets on that hierarchy -- react-native-safe-area-
// context's useSafeAreaInsets().bottom already reflects that, no manual
// buffer on top of it needed. (Two earlier wrong guesses here: adding a
// +60 buffer on top of insets.bottom left a large dead zone above the
// pill; dropping insets.bottom entirely for a flat 24 undershot and left
// content clipped behind it. insets.bottom alone is the actual pill
// footprint.) Android's JS tab bar already reserves real layout height for
// itself (see (tabs)/_layout.tsx's tabBarStyle.height), so no extra
// clearance is needed there.
export function useTabBarBottomClearance() {
  const insets = useSafeAreaInsets();
  return Platform.OS === "ios" ? insets.bottom : 0;
}
