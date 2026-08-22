"use client";

import { useEffect } from "react";

// Catches errors outside the authenticated app shell (login, Plaid OAuth
// redirect) — kept minimal and dependency-free since it must render even if
// the app shell itself is what's broken.
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Root error boundary", error);
  }, [error]);

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>Try again, or reload the page.</p>
      <button
        onClick={reset}
        style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
      >
        Try again
      </button>
    </div>
  );
}
