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
import { View } from "react-native";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
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
          {/* headerShown: false here too -- these screens render their own
              top-left title (ScreenHeader) matching the tab screens' own
              header treatment, instead of the native centered-title bar. */}
          <Stack.Screen name="fire" options={{ headerShown: false }} />
          <Stack.Screen name="subscriptions" options={{ headerShown: false }} />
          <Stack.Screen name="investments" options={{ headerShown: false }} />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
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
