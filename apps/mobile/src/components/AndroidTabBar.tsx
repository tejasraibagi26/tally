import { useEffect, useState, type ComponentProps } from "react";
import { Keyboard, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import type { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { useThemeColors } from "@/theme/useThemeColors";
import { withAlpha } from "@/theme/colors";

// Geometry shared with useTabBarBottomClearance (lib/), which pads tab
// screens so their last row clears this floating bar.
export const ANDROID_TAB_BAR_HEIGHT = 64;
export const ANDROID_TAB_BAR_GAP = 10; // above the gesture/nav-bar inset
const SIDE_MARGIN = 16;
const INNER_PAD = 6;
const SPRING = { damping: 22, stiffness: 260, mass: 0.8 };

// expo-router bundles react-navigation without exporting its types, so the
// props come from Tabs' own tabBar prop.
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

// Child routes that are full-screen on their own and need the bottom edge
// (transaction detail's Save bar); the floating bar hides while one is open.
const HIDE_ON_NESTED = new Set(["[id]"]);

function TabItem({
  label,
  focused,
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  label: string;
  focused: boolean;
  icon: (color: string) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const pop = useSharedValue(1);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (focused) pop.value = withSequence(withTiming(0.86, { duration: 90 }), withSpring(1, SPRING));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const color = focused ? colors.brand : colors["text-2"];

  // Plain style objects only: NativeWind's interop wrapper on Pressable drops
  // a function `style`, which collapsed every tab to its content width
  // (v1.15.1). The pressed fade is tracked in state instead.
  return (
    <View style={{ flex: 1 }}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        android_ripple={null}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={accessibilityLabel ?? label}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", opacity: pressed && !focused ? 0.6 : 1 }}
      >
        <Animated.View style={iconStyle}>{icon(color)}</Animated.View>
        <Text numberOfLines={1} style={{ marginTop: 3, fontFamily: focused ? "Inter_SemiBold" : "Inter_Medium", fontSize: 11, color }}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Android's tab bar (iOS keeps the system UITabBarController, see
 * app/(tabs)/_layout.tsx): a floating rounded bar that matches the iOS 26
 * pill, with a brand-tinted highlight that springs between tabs. Absolutely
 * positioned, so it reserves no layout space -- tab screens pad themselves
 * with useTabBarBottomClearance. Hides with the keyboard up and on nested
 * full-screen routes.
 */
export function AndroidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const tabCount = state.routes.length;
  const tabWidth = width > 0 ? (width - INNER_PAD * 2) / tabCount : 0;
  const indicatorX = useSharedValue(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardUp(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (tabWidth === 0) return;
    // First measurement jumps into place; later tab changes spring.
    indicatorX.value = indicatorX.value === 0 && state.index !== 0 ? state.index * tabWidth : withSpring(state.index * tabWidth, SPRING);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicatorX.value }] }));

  const focusedRoute = state.routes[state.index]!;
  // The focused tab's own nested stack (e.g. Transactions' index -> [id]).
  const nested = focusedRoute.state;
  const nestedName = nested?.routes[nested.index ?? 0]?.name;
  if (keyboardUp || (nestedName && HIDE_ON_NESTED.has(nestedName))) return null;

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
      style={{
        position: "absolute",
        left: SIDE_MARGIN,
        right: SIDE_MARGIN,
        bottom: insets.bottom + ANDROID_TAB_BAR_GAP,
        height: ANDROID_TAB_BAR_HEIGHT,
        borderRadius: ANDROID_TAB_BAR_HEIGHT / 2,
        backgroundColor: colors.raised,
        borderWidth: 1,
        borderColor: withAlpha(colors["border-strong"], 0.35),
        flexDirection: "row",
        padding: INNER_PAD,
        elevation: 12,
        shadowColor: "#000000",
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      }}
    >
      {tabWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: INNER_PAD,
              bottom: INNER_PAD,
              left: INNER_PAD,
              width: tabWidth,
              borderRadius: (ANDROID_TAB_BAR_HEIGHT - INNER_PAD * 2) / 2,
              backgroundColor: colors["brand-subtle"],
            },
            indicatorStyle,
          ]}
        />
      )}
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        const focused = state.index === index;
        const label = typeof options.title === "string" ? options.title : route.name;
        return (
          <TabItem
            key={route.key}
            label={label}
            focused={focused}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            icon={(color) => options.tabBarIcon?.({ focused, color, size: 22 })}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
          />
        );
      })}
    </View>
  );
}
