import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { apiGet, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { syncAppIcon } from "@/lib/appIcon";

/**
 * The Tally Pop flag on mobile. The app has no link to open, so it reads the
 * account copy web's /labs/pop writes (users.ui_look via GET /api/account):
 * null = not flagged (no switch, no Pop), otherwise "pop" or "classic". The
 * last value is cached so a cold start paints the right look before the
 * network answers. The "New look" switch (Settings) saves through the same
 * PATCH /api/settings/ui-look web's switch uses, so web, mobile and emails
 * agree.
 */
type Look = "pop" | "classic" | null;

const KEY = "tally.uiLook";

interface UiLookValue {
  /** Flagged: the "New look" switch is shown. */
  flagged: boolean;
  /** Pop is on. */
  pop: boolean;
  setPop: (pop: boolean) => void;
}

const UiLookContext = createContext<UiLookValue>({ flagged: false, pop: false, setPop: () => {} });

function parse(value: unknown): Look {
  return value === "pop" || value === "classic" ? value : null;
}

export function UiLookProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [look, setLook] = useState<Look>(null);

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((v) => setLook((cur) => cur ?? parse(v)));
  }, []);

  // True once the look comes from a real answer (the account, sign-out or
  // the switch) rather than the cache -- what the icon waits for.
  const [settled, setSettled] = useState(false);

  const remember = useCallback((next: Look) => {
    setLook(next);
    setSettled(true);
    if (next) SecureStore.setItemAsync(KEY, next).catch(() => {});
    else SecureStore.deleteItemAsync(KEY).catch(() => {});
  }, []);

  // The account is the source of truth: picks up a flag set (or cleared) on
  // web since the last launch. Signing out drops back to the current look.
  useEffect(() => {
    if (status === "unauthenticated") {
      remember(null);
      return;
    }
    if (status !== "authenticated") return;
    let cancelled = false;
    apiGet<{ uiLook?: string | null }>("/api/account")
      .then((profile) => {
        if (!cancelled) remember(parse(profile.uiLook));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, remember]);

  const setPop = useCallback(
    (pop: boolean) => {
      const next = pop ? "pop" : "classic";
      remember(next);
      apiPatch("/api/settings/ui-look", { look: next }).catch(() => {});
    },
    [remember],
  );

  // The home-screen icon follows the look (lib/appIcon.ts). Waits for a
  // settled answer: null is "not flagged", which means the default icon.
  useEffect(() => {
    if (!settled) return;
    void syncAppIcon(look === "pop");
  }, [look, settled]);

  const value = useMemo(() => ({ flagged: look != null, pop: look === "pop", setPop }), [look, setPop]);
  return <UiLookContext.Provider value={value}>{children}</UiLookContext.Provider>;
}

export function useUiLook(): UiLookValue {
  return useContext(UiLookContext);
}
