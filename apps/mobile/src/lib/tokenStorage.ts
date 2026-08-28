import * as SecureStore from "expo-secure-store";

// Keychain (iOS) / EncryptedSharedPreferences-backed Keystore (Android) via
// expo-secure-store -- see the implementation plan's Phase 1, "on-device
// token storage." Access token is also cached in memory by AuthContext to
// avoid a SecureStore read on every request; these are the durable copies.
const ACCESS_TOKEN_KEY = "tally.accessToken";
const REFRESH_TOKEN_KEY = "tally.refreshToken";

export async function getStoredTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)]);
}
