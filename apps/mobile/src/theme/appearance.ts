import * as SecureStore from "expo-secure-store";

export type AppearanceMode = "light" | "dark" | "system";

const KEY = "tally.appearanceMode";

export async function getStoredAppearanceMode(): Promise<AppearanceMode> {
  const value = await SecureStore.getItemAsync(KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export async function storeAppearanceMode(mode: AppearanceMode): Promise<void> {
  if (mode === "system") {
    await SecureStore.deleteItemAsync(KEY);
  } else {
    await SecureStore.setItemAsync(KEY, mode);
  }
}
