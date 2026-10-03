import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { apiPost, ApiError, setAccessToken, registerRefreshHandler, registerSessionExpiredHandler } from "@/lib/api";
import { getStoredTokens, storeTokens, clearTokens } from "@/lib/tokenStorage";
import { getStoredBiometricLockEnabled, storeBiometricLockEnabled } from "@/lib/biometricLock";

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  // isLocked gates a third Stack.Protected branch in _layout.tsx (the lock
  // screen) whenever it's true and status is "authenticated" — see there.
  isLocked: boolean;
  // True while the app isn't in the foreground with the lock enabled, so
  // _layout.tsx can cover the screen (app switcher snapshot) without
  // demanding Face ID on return.
  isCovered: boolean;
  biometricLockEnabled: boolean;
  setBiometricLockEnabled: (enabled: boolean) => Promise<void>;
  unlock: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Back from the background after this long counts as opening the app again
// (iOS can keep it suspended for hours), so Face ID is asked.
const RELOCK_AFTER_MS = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isCovered, setIsCovered] = useState(false);
  const backgroundedAtRef = useRef<number | null>(null);
  const [biometricLockEnabled, setBiometricLockEnabledState] = useState(false);
  // AppState's listener is registered once (empty deps below) but needs the
  // latest status/biometricLockEnabled on every change event — refs avoid
  // re-subscribing (and the stale-closure bug that would come from reading
  // the state variables directly inside a listener set up once).
  const statusRef = useRef(status);
  const lockEnabledRef = useRef(biometricLockEnabled);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    lockEnabledRef.current = biometricLockEnabled;
  }, [biometricLockEnabled]);

  // The access token's own 15-minute TTL means a relaunch after that long
  // has a stale one in memory -- that's fine: apiFetch's 401-retry calls
  // this same refresh handler lazily on the first real request, so there's
  // no need to proactively refresh at bootstrap.
  useEffect(() => {
    registerRefreshHandler(async () => {
      const tokens = await getStoredTokens();
      if (!tokens) return null;
      try {
        const res = await apiPost<RefreshResponse>("/api/auth/mobile/refresh", { refreshToken: tokens.refreshToken });
        await storeTokens(res.accessToken, res.refreshToken);
        setAccessToken(res.accessToken);
        return res.accessToken;
      } catch {
        return null;
      }
    });

    registerSessionExpiredHandler(() => {
      clearTokens();
      setAccessToken(null);
      setUser(null);
      setStatus("unauthenticated");
    });

    (async () => {
      const [tokens, lockEnabled] = await Promise.all([getStoredTokens(), getStoredBiometricLockEnabled()]);
      setBiometricLockEnabledState(lockEnabled);
      if (tokens) {
        setAccessToken(tokens.accessToken);
        setStatus("authenticated");
        // A relaunch that restores an existing session is exactly the
        // "someone else opens it" case this protects against, so it starts
        // locked too, not just re-backgrounding — see the AppState effect
        // below for the other trigger.
        if (lockEnabled) setIsLocked(true);
      } else {
        setStatus("unauthenticated");
      }
    })();
  }, []);

  // Face ID is asked on app open: a cold launch (bootstrap above), or coming
  // back after RELOCK_AFTER_MS in the background, which is effectively
  // reopening it. Never on "inactive" alone -- on iOS that's the app
  // switcher, Control Center, a notification banner pulled down, or the Face
  // ID prompt itself, and locking on it re-prompted constantly (v1.14.1).
  // While not active, the screen is only covered (isCovered) so the app
  // switcher snapshot doesn't show balances. Deliberately does NOT auto-lock
  // as a side effect of biometricLockEnabled itself changing -- flipping the
  // Settings switch on shouldn't lock the user out of the session they're in.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const guarded = statusRef.current === "authenticated" && lockEnabledRef.current;
      if (next === "active") {
        const awayMs = backgroundedAtRef.current != null ? Date.now() - backgroundedAtRef.current : 0;
        backgroundedAtRef.current = null;
        // Same handler, so React batches these: the cover only drops in the
        // same render the lock screen (if any) comes up -- no flash of data.
        if (guarded && awayMs >= RELOCK_AFTER_MS) setIsLocked(true);
        setIsCovered(false);
        return;
      }
      if (next === "background" && backgroundedAtRef.current == null) backgroundedAtRef.current = Date.now();
      if (guarded) setIsCovered(true);
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isLocked,
      isCovered,
      biometricLockEnabled,
      async setBiometricLockEnabled(enabled: boolean) {
        await storeBiometricLockEnabled(enabled);
        setBiometricLockEnabledState(enabled);
      },
      async unlock() {
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock Tally", cancelLabel: "Cancel" });
        if (result.success) {
          setIsLocked(false);
          return true;
        }
        return false;
      },
      async login(email: string, password: string) {
        const res = await apiPost<LoginResponse>("/api/auth/mobile/login", { email, password });
        await storeTokens(res.accessToken, res.refreshToken);
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus("authenticated");
        // A stale true from a prior session (logged out while locked, say)
        // shouldn't carry into a session the user just typed a password
        // for.
        setIsLocked(false);
      },
      async logout() {
        const tokens = await getStoredTokens();
        if (tokens) {
          // Best-effort -- logout always "succeeds" locally even if this fails (offline, etc).
          await apiPost("/api/auth/mobile/logout", { refreshToken: tokens.refreshToken }).catch(() => {});
        }
        await clearTokens();
        setAccessToken(null);
        setUser(null);
        setStatus("unauthenticated");
        setIsLocked(false);
      },
    }),
    [status, user, isLocked, isCovered, biometricLockEnabled],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError };
