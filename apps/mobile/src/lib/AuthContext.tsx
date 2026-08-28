import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiPost, ApiError, setAccessToken, registerRefreshHandler, registerSessionExpiredHandler } from "@/lib/api";
import { getStoredTokens, storeTokens, clearTokens } from "@/lib/tokenStorage";

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
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

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
      const tokens = await getStoredTokens();
      if (tokens) {
        setAccessToken(tokens.accessToken);
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async login(email: string, password: string) {
        const res = await apiPost<LoginResponse>("/api/auth/mobile/login", { email, password });
        await storeTokens(res.accessToken, res.refreshToken);
        setAccessToken(res.accessToken);
        setUser(res.user);
        setStatus("authenticated");
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
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError };
