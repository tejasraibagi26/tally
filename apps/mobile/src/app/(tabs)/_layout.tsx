import { Tabs } from "expo-router";
import { House, List, Target, Landmark } from "lucide-react-native";
import { lightColors } from "@/theme/colors";

// MOBILE_DESIGN.md §2 -- 4-tab bottom bar (Overview / Transactions / Budgets
// / Accounts), flat chrome with a soft upward shadow instead of a hairline
// (§3.4's Wealthsimple-inspired texture).
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: lightColors.brand,
        tabBarInactiveTintColor: "#948F84",
        tabBarStyle: {
          backgroundColor: lightColors.surface,
          borderTopWidth: 0,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          shadowColor: "#1A1917",
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: "Inter" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Overview", tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={1.9} /> }} />
      <Tabs.Screen
        name="transactions"
        options={{ title: "Transactions", tabBarIcon: ({ color, size }) => <List color={color} size={size} strokeWidth={1.9} /> }}
      />
      <Tabs.Screen name="budgets" options={{ title: "Budgets", tabBarIcon: ({ color, size }) => <Target color={color} size={size} strokeWidth={1.9} /> }} />
      <Tabs.Screen
        name="accounts"
        options={{ title: "Accounts", tabBarIcon: ({ color, size }) => <Landmark color={color} size={size} strokeWidth={1.9} /> }}
      />
    </Tabs>
  );
}
