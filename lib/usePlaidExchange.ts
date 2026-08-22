"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";

/** Shared onSuccess handling for both the inline LinkButton and the OAuth redirect page. */
export function usePlaidExchange(mode: "create" | "update", itemId: string | undefined) {
  const router = useRouter();

  return useCallback(
    async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      if (mode === "create") {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicToken, metadata }),
        });
        if (!res.ok) throw new Error("Failed to exchange token");
      } else if (itemId) {
        await fetch(`/api/items/${itemId}/sync`, { method: "POST" });
      }
      router.push("/accounts");
      router.refresh();
    },
    [mode, itemId, router],
  );
}
