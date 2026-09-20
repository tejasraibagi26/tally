"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ApiKeysManager({ apiKeys }: { apiKeys: ApiKeyData[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setRevealedKey(data.key);
      setAdding(false);
      setName("");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function copyKey() {
    if (!revealedKey) return;
    try {
      await navigator.clipboard.writeText(revealedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  async function remove(key: ApiKeyData) {
    if (!window.confirm(`Revoke "${key.name}"? Anything still using it (a Shortcut, a script) will stop working immediately.`)) return;
    setBusyId(key.id);
    try {
      const res = await fetch(`/api/api-keys/${key.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke key");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {revealedKey && (
        <div className="flex flex-col gap-2 p-3 rounded-control bg-warning-subtle border border-warning/30">
          <p className="text-[13.5px] text-text">Copy this key now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate px-2.5 py-2 rounded-control bg-surface border border-border-strong text-[13px] text-text font-mono">
              {revealedKey}
            </code>
            <button
              onClick={copyKey}
              className="h-9 px-3 flex-none inline-flex items-center gap-1.5 rounded-control bg-surface border border-border-strong text-sm font-medium text-text hover:bg-sunken"
            >
              {copied ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="self-start text-[13px] text-text-2 hover:text-text">
            Done
          </button>
        </div>
      )}

      {apiKeys.length > 0 && (
        <div className="flex flex-col gap-2">
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 px-3 py-2.5 rounded-control bg-surface-2 border border-border">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-[15px] text-text truncate">{k.name}</span>
                <span className="text-[13px] text-text-3 truncate font-mono">
                  {k.keyPrefix}··· · Created {formatDate(k.createdAt)}
                  {k.lastUsedAt ? ` · Last used ${formatDate(k.lastUsedAt)}` : " · Never used"}
                </span>
              </div>
              <button
                onClick={() => remove(k)}
                disabled={busyId === k.id}
                className="text-[13px] text-negative hover:underline flex-none disabled:opacity-40"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {!adding ? (
        <div>
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            + Create token
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3 p-3 rounded-control bg-surface-2 border border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apple Shortcuts"
              autoFocus
              className="w-56 h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text"
            />
          </div>
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create token"}
            </Button>
            <button type="button" onClick={() => { setAdding(false); setError(null); }} className="text-sm text-text-2">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
