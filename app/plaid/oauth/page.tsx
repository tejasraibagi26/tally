"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaidLink } from "react-plaid-link";
import { usePlaidExchange } from "@/lib/usePlaidExchange";
import { readPlaidLinkSession, clearPlaidLinkSession } from "@/lib/plaidLinkSession";

// Registered as PLAID_REDIRECT_URI. OAuth institutions (most large US banks)
// send the user here mid-flow; we resume Link with the token we stashed
// before navigating away, per WORK.md §6.2.
export default function PlaidOAuthPage() {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof readPlaidLinkSession>>(null);
  const [redirectUri, setRedirectUri] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const onSuccess = usePlaidExchange(session?.mode ?? "create", session?.itemId);

  useEffect(() => {
    setSession(readPlaidLinkSession());
    setRedirectUri(window.location.href);
  }, []);

  const { open, ready } = usePlaidLink({
    token: session?.linkToken ?? null,
    receivedRedirectUri: redirectUri,
    onSuccess: async (publicToken, metadata) => {
      try {
        await onSuccess(publicToken, metadata);
      } catch (err) {
        console.error(err);
        setError("Something went wrong finishing the connection.");
      } finally {
        clearPlaidLinkSession();
      }
    },
    onExit: (err) => {
      if (err) console.error("Plaid OAuth Link exited with error", err);
      clearPlaidLinkSession();
      router.push("/accounts");
    },
  });

  useEffect(() => {
    if (!session) {
      setError("No pending connection found — return to Accounts and try again.");
      return;
    }
    if (ready) open();
  }, [session, ready, open]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="text-center flex flex-col gap-2">
        <span className="font-display text-2xl text-text">
          {error ? "Couldn't finish connecting" : "Finishing connection…"}
        </span>
        <span className="text-text-2 text-sm">{error ?? "Reopening Plaid Link — this only takes a second."}</span>
      </div>
    </div>
  );
}
