import "../global.css";
import { useEffect, useCallback } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { View } from "react-native";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { queryClient } from "@/lib/queryClient";
import { fontsToLoad } from "@/theme/fonts";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { status } = useAuth();
  const [fontsLoaded] = useFonts(fontsToLoad);

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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === "authenticated"}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="more" options={{ presentation: "modal", headerShown: true, title: "More" }} />
        <Stack.Screen name="fire" options={{ headerShown: true, title: "FIRE Calculator" }} />
        <Stack.Screen name="subscriptions" options={{ headerShown: true, title: "Subscriptions" }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "unauthenticated"}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
