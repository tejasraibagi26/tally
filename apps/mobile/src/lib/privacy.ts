import * as SecureStore from "expo-secure-store";

const KEY = "tally.hideAmounts";

export async function getStoredHideAmounts(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(KEY);
  return value === "true";
}

export async function storeHideAmounts(hidden: boolean): Promise<void> {
  if (hidden) {
    await SecureStore.setItemAsync(KEY, "true");
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}
