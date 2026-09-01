import * as SecureStore from "expo-secure-store";

// Same local-only, SecureStore-backed preference pattern as theme/appearance.ts
// and lib/privacy.ts — this is a device posture, not something that needs to
// sync across devices via the server.
const KEY = "tally.biometricLockEnabled";

export async function getStoredBiometricLockEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(KEY)) === "1";
}

export async function storeBiometricLockEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(KEY, "1");
  } else {
    await SecureStore.deleteItemAsync(KEY);
  }
}
