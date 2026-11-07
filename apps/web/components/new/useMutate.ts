"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/toast";

/**
 * One JSON call to an existing API route, then a refresh of the server
 * components so the page shows the new state. Failures toast; the caller
 * gets null back and keeps whatever the user typed.
 */
export function useMutate() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run<T = unknown>(method: "POST" | "PUT" | "PATCH" | "DELETE", url: string, body?: unknown, ok?: string): Promise<T | null> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) {
        showToast(typeof data?.error === "string" && data.error !== "Invalid request" ? data.error : "Couldn't save that. Try again.", "negative");
        return null;
      }
      if (ok) showToast(ok);
      router.refresh();
      return data;
    } catch {
      showToast("Couldn't reach Tally. Check your connection.", "negative");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy };
}
