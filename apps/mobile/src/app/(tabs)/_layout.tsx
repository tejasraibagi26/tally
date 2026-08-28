import { Platform } from "react-native";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useThemeColors } from "@/theme/useThemeColors";
import { withAlpha } from "@/theme/colors";

const { Icon, Label } = NativeTabs.Trigger;

// A genuinely native tab bar (UITabBarController on iOS, Material 3
// NavigationBar on Android) instead of the JS-rendered one this replaced --
// on iOS this automatically picks up the OS's own tab bar chrome (the
// floating "Liquid Glass" pill on iOS 26+, whatever came before it on older
// versions) with zero glass-specific code here; on Android it fixes the
// stock black circular press ripple by giving it a themed color instead of
// (and lets the OS handle safe-area/gesture-bar insets itself, so none of
// the manual insets math the old JS tab bar needed applies here).
export default function TabsLayout() {
  const colors = useThemeColors();
  return (
    <NativeTabs
      tintColor={colors.brand}
      iconColor={{ default: colors["text-3"], selected: colors.brand }}
      labelStyle={{
        default: { fontFamily: "Inter", fontSize: 10.5, color: colors["text-3"] },
        selected: { fontFamily: "Inter", fontSize: 10.5, color: colors.brand },
      }}
      rippleColor={withAlpha(colors.brand, 0.14)}
      backgroundColor={Platform.OS === "android" ? colors.surface : undefined}
    >
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <Label>Overview</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <Icon sf="arrow.left.arrow.right" md="swap_horiz" />
        <Label>Transactions</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="budgets">
        <Icon sf={{ default: "chart.pie", selected: "chart.pie.fill" }} md="savings" />
        <Label>Budgets</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="accounts">
        <Icon sf={{ default: "building.columns", selected: "building.columns.fill" }} md="account_balance" />
        <Label>Accounts</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
