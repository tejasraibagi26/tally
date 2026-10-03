import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { House, ArrowLeftRight, PiggyBank, Landmark } from "lucide-react-native";
import { AndroidTabBar } from "@/components/AndroidTabBar";
import { useThemeColors } from "@/theme/useThemeColors";

const { Icon, Label } = NativeTabs.Trigger;

// iOS keeps the system tab bar (UITabBarController -- the floating "Liquid
// Glass" pill on iOS 26+). Android's native Material 3 NavigationBar looked
// wrong (small icons, unfamiliar proportions), and react-navigation's stock
// JS bar read as flat and generic, so Android renders its own floating bar
// that matches the iOS pill: components/AndroidTabBar.tsx (mobile v1.15.0).
function AndroidTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AndroidTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: "Overview", tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={1.9} /> }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: "Transactions", tabBarIcon: ({ color, size }) => <ArrowLeftRight color={color} size={size} strokeWidth={1.9} /> }}
      />
      <Tabs.Screen name="budgets" options={{ title: "Budgets", tabBarIcon: ({ color, size }) => <PiggyBank color={color} size={size} strokeWidth={1.9} /> }} />
      <Tabs.Screen
        name="accounts"
        options={{ title: "Accounts", tabBarIcon: ({ color, size }) => <Landmark color={color} size={size} strokeWidth={1.9} /> }}
      />
    </Tabs>
  );
}

function IosNativeTabsLayout() {
  const colors = useThemeColors();
  return (
    <NativeTabs
      tintColor={colors.brand}
      iconColor={{ default: colors["text-3"], selected: colors.brand }}
      // Left unset, iOS 26's floating "Liquid Glass" bar defaults to
      // `minimizeBehavior: "automatic"` -- it auto-shrinks into a
      // compact, severely label-truncated pill once a screen scrolls
      // (confirmed live: "Overview"/"Transactions" collapsed to "Ov…"/
      // "Transa…" on scroll). Pinned to "never" so it always renders at
      // full size.
      minimizeBehavior="never"
      labelStyle={{
        default: { fontFamily: "Inter", fontSize: 10.5, color: colors["text-3"] },
        selected: { fontFamily: "Inter", fontSize: 10.5, color: colors.brand },
      }}
    >
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Overview</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <Icon sf="arrow.left.arrow.right" />
        <Label>Transactions</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="budgets">
        <Icon sf={{ default: "chart.pie", selected: "chart.pie.fill" }} />
        <Label>Budgets</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="accounts">
        <Icon sf={{ default: "building.columns", selected: "building.columns.fill" }} />
        <Label>Accounts</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

export default function TabsLayout() {
  return Platform.OS === "ios" ? <IosNativeTabsLayout /> : <AndroidTabsLayout />;
}
