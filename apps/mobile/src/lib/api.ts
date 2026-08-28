// Fetch wrapper for every call into the Tally API. Injects the bearer
// access token from memory (set by AuthContext on login/refresh so we're
// not hitting SecureStore on every request), and on a 401 attempts exactly
// one silent refresh-and-retry before giving up -- see AuthContext.tsx for
// what happens when that refresh itself fails (session is cleared, user is
// routed back to login).

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://tally.useuplift.live";

let inMemoryAccessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;
let onSessionExpired: (() => void) | null = null;

/** Called by AuthContext whenever the access token changes (login, refresh, logout). */
export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

/** Called once by AuthContext on mount. Must resolve to a new access token, or null if refresh failed. */
export function registerRefreshHandler(fn: () => Promise<string | null>): void {
  refreshHandler = fn;
}

/** Called once by AuthContext on mount. Invoked when a refresh attempt fails -- i.e. the session is truly over. */
export function registerSessionExpiredHandler(fn: () => void): void {
  onSessionExpired = fn;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function rawFetch(path: string, options: RequestInit, accessToken: string | null): Promise<Response> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawFetch(path, options, inMemoryAccessToken);

  if (res.status === 401 && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      res = await rawFetch(path, options, newToken);
    } else {
      onSessionExpired?.();
      throw new ApiError(401, "Session expired");
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
}
