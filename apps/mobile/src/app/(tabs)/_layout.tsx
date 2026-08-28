import { Platform, Pressable } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { House, ArrowLeftRight, PiggyBank, Landmark } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/theme/useThemeColors";
import { withAlpha } from "@/theme/colors";

const { Icon, Label } = NativeTabs.Trigger;

// A themed ripple instead of react-navigation's default black circle on
// tap -- there's no prop for the ripple color on BottomTabNavigationOptions
// itself, so this replaces the tab bar's button entirely with a plain
// Pressable carrying an explicit android_ripple color.
function RippleTabButton({ children, style, rippleColor, ...rest }: any) {
  return (
    <Pressable
      {...rest}
      style={[{ flex: 1, alignItems: "center", justifyContent: "center" }, style]}
      android_ripple={{ color: rippleColor, borderless: false }}
    >
      {children}
    </Pressable>
  );
}

// iOS's dev-client build already has expo-router's native tab bar compiled
// in (UITabBarController -- the floating "Liquid Glass" pill on iOS 26+),
// and it looked right there. Android's native Material 3 NavigationBar
// looked wrong even after tinting the selection indicator (small icons,
// unfamiliar proportions vs. the rest of the app) -- reverted to the
// JS-rendered bar there, fixing the original black-ripple complaint
// properly this time via RippleTabButton instead of accepting the default.
function AndroidTabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const rippleColor = withAlpha(colors.brand, 0.14);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors["text-3"],
        tabBarButton: (props) => <RippleTabButton {...props} rippleColor={rippleColor} />,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          // A fixed height/paddingBottom opts the tab bar out of
          // react-navigation's own safe-area handling, so the bottom inset
          // (Android's gesture-nav bar) has to be added back in by hand --
          // without it, the gesture bar sits right on top of the tab labels.
          height: 62 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: "Inter" },
      }}
    >
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
