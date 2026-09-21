import { Stack } from "expo-router";

// Scopes this single route under its own tiny Stack so expo-router doesn't
// flatten it into the parent Tabs navigator as a visible 5th tab button --
// same fix as transactions/_layout.tsx, applied to a lone screen instead of
// a list+detail pair. This is also what gives router.back() real push/pop
// semantics here (a bare flat file directly under (tabs)/ would just be
// another route the Tabs navigator can show, with no back-history of its
// own). Reached only from the "More" sheet, never a tab bar button.
export default function InvestmentsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
