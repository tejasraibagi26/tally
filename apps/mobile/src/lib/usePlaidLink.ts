import { createElement, useState, useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { createPlaidLinkSession } from "react-native-plaid-link-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { SYNC_SUCCESS_HOLD_MS } from "@tally/core/syncDialog";
import { createLinkToken, exchangePublicToken } from "@/lib/queries/plaid";
import { ApiError, NetworkError, apiGet, apiPost } from "@/lib/api";
import { ProgressSheet, type ProgressState } from "@/components/accounts/ProgressSheet";

/** Let a closing sheet finish before Plaid Link presents: iOS won't stack a native modal on one that's animating out. */
const SHEET_CLOSE_MS = 350;

type Failures = { product: string; label: string }[];

function errorCode(err: unknown): string | null {
  if (err instanceof NetworkError) return "NETWORK";
  if (err instanceof ApiError) return err.code;
  return null;
}

class LinkExitError extends Error {
  constructor(
    public code: string,
    public institutionName: string | null,
  ) {
    super(code);
  }
}

// Wraps the native Plaid Link SDK (Phase 5 of the implementation plan) --
// the one piece that forces a custom dev client instead of plain Expo Go.
// OAuth-institution redirects (a bank that hands control to its own web
// login) need their own registered Universal Link/App Link or custom URL
// scheme in the Plaid dashboard, separate from the web app's
// PLAID_REDIRECT_URI -- not configured yet, so this works today against
// Plaid's non-OAuth sandbox test institutions but a real OAuth bank
// wouldn't complete the redirect back into the app.
//
// Also owns the ProgressSheet for the stretch after Link closes (syncing →
// success | partial | failed): callers render the returned `progressSheet`.
export function usePlaidLink() {
  const [isLinking, setIsLinking] = useState(false);
  // Which connection the open Link session is for ("create" for a new one),
  // so only that card's button spins -- isLinking alone made every broken
  // card's Reconnect spin at once.
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  // Bumped once a Link session is over and again when the progress sheet
  // closes. Android can leave views that changed while Plaid Link's own
  // activity covered the app laid out but undrawn (a blank card after a
  // relink); screens key their connection list on this so those views are
  // re-created once the app is back in front.
  const [renderEpoch, setRenderEpoch] = useState(0);
  const bumpEpoch = useCallback(() => {
    setTimeout(() => setRenderEpoch((n) => n + 1), Platform.OS === "android" ? 250 : 0);
  }, []);
  const lastRequest = useRef<{ mode: "create" | "update"; itemId?: string }>({ mode: "create" });
  const queryClient = useQueryClient();

  const finishRequest = useCallback(
    async (request: () => Promise<{ institutionName: string | null; failures: Failures }>) => {
      try {
        const result = await request();
        await queryClient.invalidateQueries({ queryKey: ["accounts"] });
        setProgress(
          (p) =>
            p && {
              ...p,
              institutionName: result.institutionName ?? p.institutionName,
              failures: result.failures,
              phase: result.failures.length > 0 ? "partial" : "success",
            },
        );
        return true;
      } catch (err) {
        console.error("Finishing the Plaid connection failed", err);
        setProgress((p) => p && { ...p, phase: "failed", errorCode: errorCode(err) });
        return false;
      }
    },
    [queryClient],
  );

  const openLink = useCallback(
    // Resolves true once Link finished and the follow-up exchange/resync
    // succeeded; false on cancel or error.
    async (mode: "create" | "update", itemId?: string): Promise<boolean> => {
      lastRequest.current = { mode, itemId };
      setIsLinking(true);
      setLinkingItemId(mode === "update" && itemId ? itemId : "create");
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
          setProgress({ mode, phase: "syncing", institutionName: null, accountTypes: [], failures: null, errorCode: null, errorStage: "save", startedAt: Date.now() });
          return await finishRequest(async () => {
            await apiPost("/api/mock/connect");
            return { institutionName: null, failures: [] };
          });
        }

        const { linkToken } = await createLinkToken(mode, itemId);

        const success = await new Promise<{ publicToken: string; institutionName: string | null; accountTypes: string[] } | null>((resolve, reject) => {
          createPlaidLinkSession({
            token: linkToken,
            onSuccess: (s) =>
              resolve({
                publicToken: s.publicToken,
                institutionName: s.metadata.institution?.name ?? null,
                accountTypes: s.metadata.accounts.map((a) => String(a.type ?? "").toLowerCase()).filter(Boolean),
              }),
            onExit: (exit) => {
              // Confirmed live: on a plain "closed without linking" tap, the
              // iOS SDK still calls onExit with a non-null but *empty*
              // error object (no errorCode/errorMessage) -- Plaid's own docs
              // say error should be null/undefined for a normal cancel, but
              // in practice it isn't here. Gate on errorCode specifically
              // instead of just truthiness of `error`, so an empty object
              // reads as a cancel like it's supposed to.
              if (exit.error?.errorCode) {
                console.error("Plaid Link exited with error", exit.error, exit.metadata);
                reject(new LinkExitError(String(exit.error.errorCode), exit.metadata?.institution?.name ?? null));
              } else {
                resolve(null); // user cancelled -- not an error
              }
            },
            onEvent: () => {},
          })
            .then((session) => session.open())
            .catch(reject); // session creation itself failed (bad token, native error) -- otherwise this hangs forever unresolved
        });

        if (!success) return false; // cancelled

        setProgress({
          mode,
          phase: "syncing",
          institutionName: success.institutionName,
          accountTypes: success.accountTypes,
          failures: null,
          errorCode: null,
          errorStage: "save",
          startedAt: Date.now(),
        });
        // Matches apps/web/lib/usePlaidExchange.ts: "create" exchanges the
        // public token for a new item; "update" re-authenticates an existing
        // item in place, so the follow-up is a resync instead.
        return await finishRequest(async () =>
          mode === "create"
            ? exchangePublicToken(success.publicToken)
            : apiPost<{ institutionName: string | null; failures: Failures }>(`/api/items/${itemId}/sync`),
        );
      } catch (err) {
        // Failed before or inside Plaid Link (token, SDK, or Link's own error).
        setProgress({
          mode,
          phase: "failed",
          institutionName: err instanceof LinkExitError ? err.institutionName : null,
          accountTypes: [],
          failures: null,
          errorCode: err instanceof LinkExitError ? err.code : errorCode(err),
          errorStage: "link",
          startedAt: Date.now(),
        });
        return false;
      } finally {
        setIsLinking(false);
        setLinkingItemId(null);
        bumpEpoch();
      }
    },
    [queryClient, finishRequest, bumpEpoch],
  );

  const closeProgress = useCallback(() => {
    setProgress(null);
    bumpEpoch();
  }, [bumpEpoch]);

  // A clean success holds briefly so it can be read, then closes itself.
  useEffect(() => {
    if (progress?.phase !== "success") return;
    const t = setTimeout(() => {
      setProgress(null);
      bumpEpoch();
    }, SYNC_SUCCESS_HOLD_MS[progress.mode]);
    return () => clearTimeout(t);
  }, [progress, bumpEpoch]);

  /** The failed sheet's primary action: a resync if sign-in got through, otherwise a fresh Link session. */
  const retry = useCallback(() => {
    const p = progress;
    const { mode, itemId } = lastRequest.current;
    if (p?.mode === "update" && p.errorStage === "save" && itemId) {
      setProgress({ ...p, phase: "syncing", errorCode: null, startedAt: Date.now() });
      setLinkingItemId(itemId);
      void finishRequest(() => apiPost<{ institutionName: string | null; failures: Failures }>(`/api/items/${itemId}/sync`)).finally(() => setLinkingItemId(null));
      return;
    }
    setProgress(null);
    setTimeout(() => void openLink(mode, itemId), SHEET_CLOSE_MS);
  }, [progress, finishRequest, openLink]);

  const progressSheet = createElement(ProgressSheet, { state: progress, onClose: closeProgress, onRetry: retry });

  return { openLink, isLinking, linkingItemId, progressSheet, renderEpoch };
}
