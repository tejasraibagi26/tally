import "../global.css";
import { useEffect, useState } from "react";
import { Stack, type NativeStackHeaderProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Platform, View, useWindowDimensions } from "react-native";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { TransparentHeader } from "@/components/ui/ScreenHeader";
import { PrivacyProvider } from "@/lib/PrivacyContext";
import { queryClient } from "@/lib/queryClient";
import { fontsToLoad } from "@/theme/fonts";
import { getStoredAppearanceMode } from "@/theme/appearance";
import { useThemeColors } from "@/theme/useThemeColors";
import { useResponsiveFontScale } from "@/theme/responsiveFont";
import { moreSheetDetent } from "@/lib/moreSheet";
import { BootSplash, PrivacyCover } from "@/components/BootSplash";

SplashScreen.preventAutoHideAsync();

// Longest the boot screen waits on first data before letting go anyway.
const BOOT_DATA_TIMEOUT_MS = 6000;

/**
 * True once the first screen's initial queries have settled (or after
 * BOOT_DATA_TIMEOUT_MS). Fetches only start once the navigator mounts the
 * screen, so "nothing fetching" right at mount doesn't count -- it has to
 * have seen a fetch start, or the boot draw's ~1.2s has to pass with none.
 */
function useInitialDataSettled(active: boolean): boolean {
  const fetching = useIsFetching();
  const [sawFetch, setSawFetch] = useState(false);
  const [graceOver, setGraceOver] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (fetching > 0) setSawFetch(true);
  }, [fetching]);

  useEffect(() => {
    if (!active) return;
    const grace = setTimeout(() => setGraceOver(true), 1200);
    const cap = setTimeout(() => setTimedOut(true), BOOT_DATA_TIMEOUT_MS);
    return () => {
      clearTimeout(grace);
      clearTimeout(cap);
    };
  }, [active]);

  if (!active) return false;
  return timedOut || (fetching === 0 && (sawFetch || graceOver));
}

function RootNavigator() {
  const { status, isLocked, isCovered } = useAuth();
  const [fontsLoaded] = useFonts(fontsToLoad);
  const { setColorScheme } = useColorScheme();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const fontScale = useResponsiveFontScale();
  // The More sheet's height as a fraction of the screen, from its actual
  // content rather than a fixed guess (see lib/moreSheet.ts).
  const moreDetent = moreSheetDetent({ windowHeight, fontScale, bottomInset: insets.bottom });

  // Applies a user-picked light/dark override (Settings > Appearance) on
  // cold start -- nativewind's own colorScheme.set() doesn't persist across
  // relaunches on its own, so the choice is stored separately and re-applied
  // here. No stored value (the default) leaves nativewind on "system".
  useEffect(() => {
    getStoredAppearanceMode().then((mode) => {
      if (mode !== "system") setColorScheme(mode);
    });
  }, [setColorScheme]);

  // The native splash is background-only (no mark); BootSplash takes over
  // on the same background as soon as JS is running and draws the mark.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  const shellReady = fontsLoaded && status !== "loading";
  // Signed out or locked: the login/lock screen needs no data. Signed in:
  // hold until Overview's first queries land, so the app opens on real
  // numbers instead of skeletons.
  const needsData = shellReady && status === "authenticated" && !isLocked;
  const dataSettled = useInitialDataSettled(needsData);
  const bootReady = shellReady && (!needsData || dataSettled);
  const [bootDone, setBootDone] = useState(false);
  const bootSplash = !bootDone && <BootSplash ready={bootReady} showWordmark={fontsLoaded} onDone={() => setBootDone(true)} />;


  // Transparent on both platforms: iOS's native header, Android's own
  // TransparentHeader (ScreenHeader.tsx) -- the native Android toolbar
  // couldn't be made transparent reliably.
  const pushedScreenOptions = (title: string) =>
    Platform.OS === "android"
      ? { headerShown: true, headerTransparent: true, headerTitle: title, header: (props: NativeStackHeaderProps) => <TransparentHeader {...props} /> }
      : { headerShown: true, headerTransparent: true, headerStyle: { backgroundColor: "transparent" }, headerTitle: title, headerBackTitle: "" };

  // BootSplash stays at the same spot in the tree across the !shellReady ->
  // ready switch, so its animation isn't remounted (restarted) mid-draw.
  return (
    <>
      {shellReady ? (
        <>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              headerBackTitle: "Back",
              headerBackButtonDisplayMode: "minimal",
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              headerTitleStyle: { color: colors.text },
              headerTitleAlign: "left",
            }}
          >
            {/* Split from the authenticated branch below rather than an overlay
                on top of it -- (tabs) and the pushed screens are never mounted
                while locked, so there's nothing for a screenshot/app-switcher
                preview (or just a glance at the screen) to leak underneath the
                lock screen. */}
            <Stack.Protected guard={status === "authenticated" && isLocked}>
              <Stack.Screen name="lock" />
            </Stack.Protected>
            <Stack.Protected guard={status === "authenticated" && !isLocked}>
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
                  sheetAllowedDetents: [moreDetent],
                  sheetInitialDetentIndex: 0,
                  sheetGrabberVisible: true,
                  sheetCornerRadius: 24,
                  sheetExpandsWhenScrolledToEdge: false,
                  headerShown: false,
                }}
              />
              {/* Pushed screens get an always-fixed header (title left-aligned
                  next to the back control; never part of the ScrollView, so the
                  back control can't drift on scroll the way a hand-rolled
                  absolutely-positioned chevron once did). It's transparent on
                  both platforms and reserves no layout space -- screens pad
                  their content by useScreenContentTop (ScreenHeader.tsx):
                  - iOS: the native header with headerTransparent, keeping iOS's
                    own back control (e.g. iOS 26's glass pill).
                  - Android: TransparentHeader, a plain JS view with no
                    background (back arrow, title, headerRight). The native
                    Android toolbar rendered a solid bar even with
                    headerTransparent (tested on-device), so it's replaced
                    rather than restyled. Mobile v1.9.2.
                  Per-screen actions (FIRE's Save, Investments' Sync) are
                  headerRight, set from inside each screen via its own
                  <Stack.Screen options={{...}}/> -- TransparentHeader renders
                  them on Android. */}
              <Stack.Screen name="fire" options={pushedScreenOptions("Early retirement")} />
              <Stack.Screen name="subscriptions" options={pushedScreenOptions("Subscriptions")} />
              <Stack.Screen name="upcoming" options={pushedScreenOptions("Upcoming")} />
              <Stack.Screen name="investments" options={pushedScreenOptions("Investments")} />
              <Stack.Screen name="investment-holdings" options={pushedScreenOptions("Holdings")} />
              <Stack.Screen name="settings" options={pushedScreenOptions("Settings")} />
              <Stack.Screen name="income-schedules" options={pushedScreenOptions("Income schedules")} />
              <Stack.Screen name="api-tokens" options={pushedScreenOptions("API tokens")} />
              <Stack.Screen name="alerts" options={pushedScreenOptions("Alerts")} />
              <Stack.Screen name="changelog" options={pushedScreenOptions("Changelog")} />
            </Stack.Protected>
            <Stack.Protected guard={status === "unauthenticated"}>
              <Stack.Screen name="login" />
            </Stack.Protected>
          </Stack>
        </>
      ) : (
        <View className="flex-1 bg-canvas" />
      )}
      {bootSplash}
      {isCovered && <PrivacyCover />}
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
