import { Platform } from "react-native";
import { Stack } from "expo-router";
import { GLASS_FORM_SHEET_IOS } from "@/components/ui/nativeBlur";

// Without this, expo-router flattens index.tsx and [id].tsx into separate
// top-level entries in the parent Tabs navigator instead of nesting them --
// [id] showed up as its own 5th tab. This Stack scopes both routes inside
// the "Transactions" tab, with [id] presented as a modal on top of the list.
export default function TransactionsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      {/* iOS: the same floating glass sheet as More and every other sheet
          (0.92 so it floats -- a full-height detent sits flush). Android: modal. */}
      <Stack.Screen
        name="[id]"
        options={Platform.OS === "ios" ? { ...GLASS_FORM_SHEET_IOS, sheetAllowedDetents: [0.92], sheetInitialDetentIndex: 0 } : { presentation: "modal" }}
      />
      <Stack.Screen name="review" options={{ presentation: "fullScreenModal" }} />
    </Stack>
  );
}
