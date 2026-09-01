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
  biometricLockEnabled: boolean;
  setBiometricLockEnabled: (enabled: boolean) => Promise<void>;
  unlock: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [isLocked, setIsLocked] = useState(false);
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

  // Re-lock on every backgrounding while authenticated (not just relaunch).
  // Deliberately does NOT auto-lock as a side effect of biometricLockEnabled
  // itself changing — flipping the Settings switch on shouldn't instantly
  // lock the user out of the session they're actively in.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active" && statusRef.current === "authenticated" && lockEnabledRef.current) {
        setIsLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isLocked,
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
    [status, user, isLocked, biometricLockEnabled],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError };
