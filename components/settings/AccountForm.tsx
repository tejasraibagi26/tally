"use client";

import { useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const inputClass =
  "h-9 rounded-control border border-border-strong bg-surface px-3 text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-info";
const labelClass = "text-xs font-medium uppercase tracking-wide text-text-2";

export function AccountForm({ initialName, initialEmail }: { initialName: string; initialEmail: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      if (data.emailChanged) {
        // Email is embedded in the JWT session token at sign-in — force a
        // fresh login so the session reflects what's actually in the DB.
        await signOut({ callbackUrl: "/login" });
        return;
      }
      setCurrentPassword("");
      setSaved(true);
      setLoading(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="name">
          Name
        </label>
        <input
          id="name"
          className={inputClass}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          className={inputClass}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setSaved(false);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="current-password-profile">
          Current password
        </label>
        <input
          id="current-password-profile"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Required to save changes"
          className={inputClass}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
        {saved && <span className="text-sm text-positive">Saved</span>}
      </div>
    </form>
  );
}
