import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";
import { colorScheme } from "nativewind";
// NativeWind's own scheme value (the module nativewind itself uses). See applyAppearanceMode.
import { systemColorScheme } from "react-native-css-interop/dist/runtime/native/appearance-observables";

export type AppearanceMode = "light" | "dark" | "system";

const KEY = "tally.appearanceMode";

const parse = (value: string | null): AppearanceMode => (value === "light" || value === "dark" ? value : "system");

export async function getStoredAppearanceMode(): Promise<AppearanceMode> {
  return parse(await SecureStore.getItemAsync(KEY));
}

export async function storeAppearanceMode(mode: AppearanceMode): Promise<void> {
  if (mode === "system") {
    await SecureStore.deleteItemAsync(KEY);
  } else {
    await SecureStore.setItemAsync(KEY, mode);
  }
}

/**
 * Makes the whole app follow `mode`: React Native's Appearance (what
 * react-native's useColorScheme -- the boot splash -- the native header and
 * system alerts read) and NativeWind's classNames and useColorScheme.
 *
 * NativeWind needs its value set directly. colorScheme.set() only forwards
 * to Appearance and waits for the change event, which NativeWind ignores
 * unless the app is "active" -- and at cold start it isn't yet. So it kept
 * the scheme it captured when its module loaded (the phone's, dark) until
 * the app turned active, and Overview drew dark, then flipped to light.
 */
export function applyAppearanceMode(mode: AppearanceMode): void {
  Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
  colorScheme.set(mode);
  const resolved = mode === "system" ? Appearance.getColorScheme() : mode;
  systemColorScheme.set(resolved === "dark" ? "dark" : "light");
}

/**
 * The saved choice, applied synchronously before the first render (app
 * _layout.tsx, module scope). Reading it with getItemAsync and applying it in
 * an effect drew the first screens in the phone's theme and then flipped:
 * a light choice on a phone in Dark Mode opened dark, then went light.
 */
export function applyStoredAppearanceModeSync(): void {
  try {
    const mode = parse(SecureStore.getItem(KEY));
    if (mode !== "system") applyAppearanceMode(mode);
  } catch {
    // Unreadable keychain (e.g. before first unlock): stay on the system theme.
  }
}
