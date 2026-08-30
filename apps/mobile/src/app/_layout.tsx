import "../global.css";
import { useEffect, useCallback } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Platform, View } from "react-native";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { NativeBackButton } from "@/components/ui/ScreenHeader";
import { PrivacyProvider } from "@/lib/PrivacyContext";
import { queryClient } from "@/lib/queryClient";
import { fontsToLoad } from "@/theme/fonts";
import { getStoredAppearanceMode } from "@/theme/appearance";
import { useThemeColors } from "@/theme/useThemeColors";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();
  const [fontsLoaded] = useFonts(fontsToLoad);
  const { setColorScheme } = useColorScheme();
  const colors = useThemeColors();

  // Applies a user-picked light/dark override (Settings > Appearance) on
  // cold start -- nativewind's own colorScheme.set() doesn't persist across
  // relaunches on its own, so the choice is stored separately and re-applied
  // here. No stored value (the default) leaves nativewind on "system".
  useEffect(() => {
    getStoredAppearanceMode().then((mode) => {
      if (mode !== "system") setColorScheme(mode);
    });
  }, [setColorScheme]);

  const onLayout = useCallback(async () => {
    if (fontsLoaded && status !== "loading") {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, status]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  if (!fontsLoaded || status === "loading") {
    return <View className="flex-1 bg-canvas" />;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          headerTitleAlign: "left",
        }}
      >
        <Stack.Protected guard={status === "authenticated"}>
          <Stack.Screen name="(tabs)" />
          {/* A true content-sized bottom sheet (native detents), not a full-screen
              modal -- fixes both the giant dead space below the last row and the
              "feels like a full page" complaint. Rows close this sheet (router.back())
              before pushing their destination (see more.tsx), so those screens open
              as plain pushes from (tabs) rather than nesting inside this presentation
              context -- pushing directly from within a modal/sheet would otherwise
              carry its sheet chrome (rounded corners, swipe-to-dismiss) along too.
              headerShown is off here (unlike the other screens below) because
              react-native-screens' formSheet header floats over the content
              instead of reserving space for it -- more.tsx renders its own
              "More" label inline instead. */}
          <Stack.Screen
            name="more"
            options={{
              presentation: "formSheet",
              // "fitToContents" left a persistent gap between the sheet's
              // measured height and the true screen edge (a react-native-screens
              // auto-sizing quirk) -- an explicit fraction sizes the sheet
              // deterministically and sits flush to the bottom instead.
              sheetAllowedDetents: [0.46],
              sheetInitialDetentIndex: 0,
              sheetGrabberVisible: true,
              sheetCornerRadius: 24,
              sheetExpandsWhenScrolledToEdge: false,
              headerShown: false,
            }}
          />
          {/* Real native header, title included (left-aligned, next to the
              back control, per screenOptions' headerTitleAlign above) --
              these screens no longer render their own separate in-content
              title row (ScreenTitle/ScreenHeader are now just for
              non-scrolling loading/empty states without a title, plus
              useScreenContentTop). The back control itself is native and
              always fixed (never part of the ScrollView, so it can't drift
              out of alignment the way a hand-rolled absolutely-positioned
              chevron once did here). headerTransparent only applies on iOS:
              react-native-screens' native-stack doesn't support a real
              transparent floating header on Android (tested on-device --
              headerTransparent: true there still renders a solid opaque
              bar), so Android gets the platform's own normal toolbar
              instead, which is the native Android pattern for a pushed
              screen anyway (root/tab screens like Overview stay
              header-less since those aren't pushed) -- accepted tradeoff:
              it reserves real vertical space Overview's screens don't have.
              Android also needs NativeBackButton as an explicit headerLeft
              (native-stack rendered no back arrow at all there once
              headerTitle was empty, tested); iOS keeps its own default back
              control (e.g. iOS 26's glass pill) since headerLeft is only
              set for Android below. Per-screen action buttons (FIRE's
              Save, Investments' Sync) now live in headerRight, set from
              inside each screen via its own <Stack.Screen options={{...}}/>
              -- see fire.tsx/investments.tsx. useScreenContentTop
              (ScreenHeader.tsx) matches the transparency split: iOS's
              header reserves no layout space, so content needs manual
              padding to clear it; Android's opaque one already reserves its
              own space, so content needs none. */}
          <Stack.Screen name="fire" options={{ headerShown: true, headerTransparent: Platform.OS === "ios", headerTitle: "FIRE Calculator", headerBackTitle: "", headerLeft: Platform.OS === "android" ? NativeBackButton : undefined }} />
          <Stack.Screen name="subscriptions" options={{ headerShown: true, headerTransparent: Platform.OS === "ios", headerTitle: "Subscriptions", headerBackTitle: "", headerLeft: Platform.OS === "android" ? NativeBackButton : undefined }} />
          <Stack.Screen name="investments" options={{ headerShown: true, headerTransparent: Platform.OS === "ios", headerTitle: "Investments", headerBackTitle: "", headerLeft: Platform.OS === "android" ? NativeBackButton : undefined }} />
          <Stack.Screen name="settings" options={{ headerShown: true, headerTransparent: Platform.OS === "ios", headerTitle: "Settings", headerBackTitle: "", headerLeft: Platform.OS === "android" ? NativeBackButton : undefined }} />
        </Stack.Protected>
        <Stack.Protected guard={status === "unauthenticated"}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PrivacyProvider>
              <RootNavigator />
            </PrivacyProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
