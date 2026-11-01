import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";
import { colorScheme } from "nativewind";

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
 * Makes the whole app follow `mode`: NativeWind's classNames, and React
 * Native's Appearance -- which is what useColorScheme from react-native (the
 * boot splash), the native header and system alerts read. Setting only
 * NativeWind left those on the phone's own theme.
 */
export function applyAppearanceMode(mode: AppearanceMode): void {
  Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
  colorScheme.set(mode);
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
