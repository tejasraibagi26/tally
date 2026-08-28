import { Platform } from "react-native";

// iOS's floating "Liquid Glass" tab bar pill (unstable-native-tabs) doesn't
// reserve scroll-view content inset the way the old full-width tab bar did
// -- without this, a screen's last rounded card/list corner scrolls out
// from underneath/beside the pill instead of stopping clear of it. This is
// a *small* top-up on top of the automatic safe-area inset the ScrollView
// already gets (an earlier version double-counted insets.bottom on top of
// that automatic inset plus too large a manual buffer, which left a big
// dead zone above the pill instead of just clearing it). Android's JS tab
// bar already reserves real layout height for itself (see
// (tabs)/_layout.tsx's tabBarStyle.height), so no extra clearance is needed
// there.
export function useTabBarBottomClearance() {
  return Platform.OS === "ios" ? 24 : 0;
}
