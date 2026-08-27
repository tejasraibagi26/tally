"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Unplug } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoadingOverlay } from "@/components/ui/LoadingOverlay";
import { cn } from "@/lib/cn";

export function ItemActionsMenu({ itemId, institutionName }: { itemId: string; institutionName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [busy, setBusy] = useState<"refresh" | "revoke" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function refreshBalances() {
    setOpen(false);
    setBusy("refresh");
    try {
      const res = await fetch(`/api/items/${itemId}/refresh-balances`, { method: "POST" });
      if (!res.ok) throw new Error("Refresh failed");
      router.refresh();
    } catch (err) {
      console.error(err);
      window.alert("Couldn't refresh balances. Please try again in a moment.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    setBusy("revoke");
    try {
      const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove item");
      router.refresh();
    } catch (err) {
      console.error(err);
      window.alert("Couldn't revoke this connection. Please try again in a moment.");
    } finally {
      setBusy(null);
      setConfirmRevoke(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy !== null}
        aria-label="Connection actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-7 h-7 flex-none flex items-center justify-center rounded-control text-text-3 hover:text-text hover:bg-sunken text-base disabled:opacity-40"
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-20 w-52 bg-surface border border-border rounded-control shadow-overlay py-1 flex flex-col"
        >
          <button
            role="menuitem"
            onClick={refreshBalances}
            className="flex items-center gap-2.5 px-3 py-2 text-[13.5px] text-text hover:bg-sunken text-left"
          >
            <RefreshCw size={14} strokeWidth={1.75} className="text-text-3 flex-none" />
            Refresh balances
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirmRevoke(true);
            }}
            className={cn("flex items-center gap-2.5 px-3 py-2 text-[13.5px] text-negative hover:bg-negative-subtle text-left")}
          >
            <Unplug size={14} strokeWidth={1.75} className="flex-none" />
            Revoke connection
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmRevoke}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={revoke}
        title={`Revoke ${institutionName}?`}
        confirmLabel="Revoke connection"
        confirming={busy === "revoke"}
        description={
          <>
            <p className="m-0">This disconnects {institutionName} from Plaid and permanently deletes everything locally tied to it:</p>
            <ul className="m-0 pl-5 list-disc flex flex-col gap-1">
              <li>Every account under this connection</li>
              <li>All of their transaction history, balances, and holdings</li>
              <li>Any budgets or rules that reference those transactions won&apos;t be retroactively affected, but new transactions from here stop entirely</li>
            </ul>
            <p className="m-0 font-medium text-text">This cannot be undone. You&apos;d need to reconnect from scratch to get this data back.</p>
          </>
        }
      />

      {busy && <LoadingOverlay message={busy === "refresh" ? "Refreshing balances…" : "Revoking connection…"} />}
    </div>
  );
}
