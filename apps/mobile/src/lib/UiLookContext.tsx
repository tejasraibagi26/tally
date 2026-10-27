import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { apiGet, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { syncAppIcon } from "@/lib/appIcon";

/**
 * The look on mobile: Tally Pop is the default (mobile v2.3.0); the classic
 * look is an opt-out, chosen with "New look" in Settings. The account copy
 * (users.ui_look via GET /api/account) is the source of truth -- null means
 * never chosen, so Pop -- and it's shared with web and emails: the switch
 * saves through PATCH /api/settings/ui-look. The last value is cached so a
 * cold start paints the right look before the network answers.
 */
type Look = "pop" | "classic" | null;

const KEY = "tally.uiLook";

interface UiLookValue {
  /** Always true since Pop became the default: the "New look" switch shows for everyone. */
  flagged: boolean;
  /** Pop is on. */
  pop: boolean;
  setPop: (pop: boolean) => void;
}

const UiLookContext = createContext<UiLookValue>({ flagged: true, pop: true, setPop: () => {} });

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
  // settled answer: null means never chosen, which is Pop (the primary icon).
  useEffect(() => {
    if (!settled) return;
    void syncAppIcon(look !== "classic");
  }, [look, settled]);

  // Pop unless the account chose classic (null = never chose).
  const value = useMemo(() => ({ flagged: true, pop: look !== "classic", setPop }), [look, setPop]);
  return <UiLookContext.Provider value={value}>{children}</UiLookContext.Provider>;
}

export function useUiLook(): UiLookValue {
  return useContext(UiLookContext);
}
