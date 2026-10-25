"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import { LogoMark } from "@/components/Logo";
import { DemoCta } from "@/components/demo/DemoCta";

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Incorrect email or password.");
      return;
    }
    router.push(params.get("callbackUrl") ?? "/overview");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm bg-surface border border-border rounded-panel shadow-raised p-8 flex flex-col gap-5"
    >
      <div className="flex flex-col items-center gap-3 pb-2 text-center">
        <div style={{ animation: "empty-pop 450ms ease-out" }}>
          <LogoMark size={40} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-display text-2xl text-text">Sign in</span>
          <span className="text-[14.5px] text-text-2">See exactly where you stand.</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-text-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 rounded-control border border-border-strong bg-surface px-3 text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-info"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-text-2">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9 rounded-control border border-border-strong bg-surface px-3 text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-info"
        />
      </div>

      {error && <InlineError>{error}</InlineError>}

      <Button type="submit" loading={loading} className="w-full">
        Sign in
      </Button>

      {demoMode && (
        <>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-text-3">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <DemoCta variant="secondary" className="w-full" />
        </>
      )}

      <span className="text-xs text-text-3 text-center whitespace-nowrap">
        Invite-only instance.{" "}
        <Link href="/docs" className="text-brand hover:underline">
          Self-host your own →
        </Link>
      </span>
    </form>
  );
}
