import { useState, useCallback } from "react";
import { createPlaidLinkSession } from "react-native-plaid-link-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { createLinkToken, exchangePublicToken } from "@/lib/queries/plaid";
import { apiGet, apiPost } from "@/lib/api";

// Wraps the native Plaid Link SDK (Phase 5 of the implementation plan) --
// the one piece that forces a custom dev client instead of plain Expo Go.
// OAuth-institution redirects (a bank that hands control to its own web
// login) need their own registered Universal Link/App Link or custom URL
// scheme in the Plaid dashboard, separate from the web app's
// PLAID_REDIRECT_URI -- not configured yet, so this works today against
// Plaid's non-OAuth sandbox test institutions but a real OAuth bank
// wouldn't complete the redirect back into the app.
export function usePlaidLink() {
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const openLink = useCallback(
    async (mode: "create" | "update", itemId?: string) => {
      setError(null);
      setIsLinking(true);
      try {
        // Mirrors apps/web/app/(app)/accounts/page.tsx's `mock={MOCK_MODE}`
        // on LinkButton exactly -- when the backend has no real Plaid
        // credentials configured (the local-dev default), "Add account"
        // skips Plaid Link entirely and seeds a mock institution instead.
        // Reconnect (update mode) has no mock equivalent on web either, since
        // mock items never actually go into a broken/critical state.
        //
        // Fetched fresh here (via the query cache, not a separately-mounted
        // useAppConfig() hook) rather than read from a hook's possibly-still-
        // loading state -- the earlier version raced: tapping "Add" before
        // that query resolved left `config` undefined, which fell through to
        // the real Plaid flow every time on a cold screen.
        const config = await queryClient.fetchQuery({
          queryKey: ["config"],
          queryFn: () => apiGet<{ mockMode: boolean }>("/api/config"),
          staleTime: Infinity,
        });

        if (mode === "create" && config.mockMode) {
          await apiPost("/api/mock/connect");
          await queryClient.invalidateQueries({ queryKey: ["accounts"] });
          return;
        }

        const { linkToken } = await createLinkToken(mode, itemId);

        const publicToken = await new Promise<string | null>((resolve, reject) => {
          createPlaidLinkSession({
            token: linkToken,
            onSuccess: (success) => resolve(success.publicToken),
            onExit: (exit) => {
              if (exit.error) reject(new Error(exit.error.errorMessage ?? "Plaid Link exited with an error"));
              else resolve(null); // user cancelled -- not an error
            },
            onEvent: () => {},
          })
            .then((session) => session.open())
            .catch(reject); // session creation itself failed (bad token, native error) -- otherwise this hangs forever unresolved
        });

        if (!publicToken) return; // cancelled

        // Matches apps/web/lib/usePlaidExchange.ts exactly: "create" exchanges
        // the public token for a new item; "update" re-authenticates an
        // existing item in place, so the follow-up is a resync instead.
        if (mode === "create") {
          await exchangePublicToken(publicToken);
        } else if (itemId) {
          await apiPost(`/api/items/${itemId}/sync`);
        }

        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong connecting your account.");
      } finally {
        setIsLinking(false);
      }
    },
    [queryClient],
  );

  return { openLink, isLinking, error };
}
