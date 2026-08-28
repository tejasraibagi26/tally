import { Tabs } from "expo-router";
import { House, ArrowLeftRight, PiggyBank, Landmark } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "@/theme/useThemeColors";

// MOBILE_DESIGN.md §2 -- 4-tab bottom bar (Overview / Transactions / Budgets
// / Accounts), flat chrome with a soft upward shadow instead of a hairline
// (§3.4's Wealthsimple-inspired texture). Dark mode drops the shadow to a
// flat top hairline instead (a light shadow reads as a halo on a dark
// surface), same rule Card.tsx follows.
export default function TabsLayout() {
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const dark = colorScheme === "dark";
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors["text-3"],
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: dark ? 1 : 0,
          borderTopColor: colors.border,
          // A fixed height/paddingBottom opts the tab bar out of
          // react-navigation's own safe-area handling, so the bottom inset
          // (iOS home indicator, Android's gesture-nav bar) has to be added
          // back in by hand -- without it, Android's gesture bar sits right
          // on top of the tab labels.
          height: 62 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          shadowColor: "#000000",
          shadowOpacity: dark ? 0 : 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: dark ? 0 : 8,
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
