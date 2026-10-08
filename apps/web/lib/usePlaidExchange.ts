"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { saveSyncFailureHandoff } from "@/lib/syncFailureHandoff";

export interface ExchangeResult {
  institutionName: string | null;
  failures: { product: string; label: string }[];
}

/** Thrown when the exchange or resync fails; `code` is Plaid's error_code, "NETWORK", or null. */
export class ExchangeError extends Error {
  constructor(public code: string | null) {
    super(`Plaid exchange failed${code ? ` (${code})` : ""}`);
  }
}

/**
 * The request half of finishing a Plaid Link session: "create" exchanges the
 * public token for a new item; "update" re-authenticated an existing item
 * in place, so the follow-up is a resync instead. Throws ExchangeError on
 * any failure, in both modes.
 */
export async function runPlaidExchange(
  mode: "create" | "update",
  publicToken: string,
  metadata: PlaidLinkOnSuccessMetadata | null,
  itemId: string | undefined,
): Promise<ExchangeResult> {
  let res: Response;
  try {
    res =
      mode === "create"
        ? await fetch("/api/plaid/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publicToken, metadata }),
          })
        : await fetch(`/api/items/${itemId}/sync`, { method: "POST" });
  } catch {
    throw new ExchangeError("NETWORK");
  }
  const body: { institutionName?: string | null; failures?: ExchangeResult["failures"]; code?: string | null } = await res.json().catch(() => ({}));
  if (!res.ok) throw new ExchangeError(body.code ?? null);
  return { institutionName: body.institutionName ?? null, failures: body.failures ?? [] };
}

/** Leaves a partial-failure notice for the Accounts page's SyncFailureToast to pick up after navigating there. */
export function handOffFailures(result: ExchangeResult) {
  if (result.failures.length > 0) saveSyncFailureHandoff({ institutionName: result.institutionName, failures: result.failures });
}

/** Exchange, hand off any failures, and go to Accounts -- the OAuth redirect page's whole job. */
export function usePlaidExchange(mode: "create" | "update", itemId: string | undefined) {
  const router = useRouter();

  return useCallback(
    // itemIdOverride: the item a shared update-mode flow was started for.
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata, itemIdOverride?: string) => {
      const result = await runPlaidExchange(mode, publicToken, metadata, itemIdOverride ?? itemId);
      handOffFailures(result);
      router.push("/accounts");
      router.refresh();
    },
    [mode, itemId, router],
  );
}
