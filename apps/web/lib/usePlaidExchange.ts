"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { saveSyncFailureHandoff } from "@/lib/syncFailureHandoff";

interface ExchangeResponse {
  institutionName?: string | null;
  failures?: { product: string; label: string }[];
}

/** Shared onSuccess handling for both the inline LinkButton and the OAuth redirect page. */
export function usePlaidExchange(mode: "create" | "update", itemId: string | undefined) {
  const router = useRouter();

  return useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      let body: ExchangeResponse = {};
      if (mode === "create") {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken, metadata }),
        });
        if (!res.ok) throw new Error("Failed to exchange token");
        body = await res.json().catch(() => ({}));
      } else if (itemId) {
        const res = await fetch(`/api/items/${itemId}/sync`, { method: "POST" });
        if (res.ok) body = await res.json().catch(() => ({}));
      }

      if (body.failures && body.failures.length > 0) {
        saveSyncFailureHandoff({ institutionName: body.institutionName ?? null, failures: body.failures });
      }

      router.push("/accounts");
      router.refresh();
    },
    [mode, itemId, router],
  );
}
