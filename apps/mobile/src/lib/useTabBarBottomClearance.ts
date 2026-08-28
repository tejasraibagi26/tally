import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// iOS's floating "Liquid Glass" tab bar pill (unstable-native-tabs) doesn't
// reserve scroll-view content inset the way the old full-width tab bar did
// -- without this, a screen's last rounded card/list corner scrolls out
// from underneath/beside the pill instead of stopping clear of it. Android's
// JS tab bar already reserves real layout height for itself (see
// (tabs)/_layout.tsx's tabBarStyle.height), so no extra clearance is needed
// there.
export function useTabBarBottomClearance() {
  const insets = useSafeAreaInsets();
  return Platform.OS === "ios" ? insets.bottom + 60 : 0;
}
