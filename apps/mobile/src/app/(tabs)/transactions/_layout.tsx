import { Stack } from "expo-router";

// Without this, expo-router flattens index.tsx and [id].tsx into separate
// top-level entries in the parent Tabs navigator instead of nesting them --
// [id] showed up as its own 5th tab. This Stack scopes both routes inside
// the "Transactions" tab, with [id] presented as a modal on top of the list.
export default function TransactionsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" options={{ presentation: "modal" }} />
    </Stack>
  );
}
