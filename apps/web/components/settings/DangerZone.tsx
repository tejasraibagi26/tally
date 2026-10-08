"use client";

import { useCallback, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DialogBody, DialogFooter, DialogHeader, DialogNote, DialogTile } from "@/components/ui/Dialog";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsLayout";
import { showToast } from "@/lib/toast";

const inputClass =
  "h-9 w-full rounded-control border border-border-strong bg-surface px-3 text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-negative disabled:opacity-60";
const labelClass = "text-xs font-medium text-text-2";

const CONFIRM_PHRASE = "WIPE";

/**
 * Settings' last group: one row whose button opens the wipe dialog. Nothing
 * destructive sits on the page itself; the dialog asks for the phrase and
 * the current password, and shows a failure in place.
 */
export function DangerZone({ itemCount }: { itemCount: number }) {
  const [open, setOpen] = useState(false);
  const banks = `${itemCount} bank${itemCount === 1 ? "" : "s"}`;

  return (
    <SettingsGroup id="delete" title="Delete data" tone="negative">
      <SettingsRow
        title="Wipe all data"
        description={
          itemCount === 0
            ? "Nothing is connected, so there's nothing to wipe."
            : `Disconnects ${itemCount === 1 ? "your" : `all ${banks}`} and deletes everything synced from ${itemCount === 1 ? "it" : "them"}. Your login stays.`
        }
      >
        <Button variant="destructive" size="sm" disabled={itemCount === 0} onClick={() => setOpen(true)} aria-haspopup="dialog" className="border" style={{ borderColor: "color-mix(in srgb, var(--negative) 50%, transparent)" }}>
          Wipe all data…
        </Button>
      </SettingsRow>
      <WipeDialog open={open} onClose={() => setOpen(false)} banks={banks} />
    </SettingsGroup>
  );
}

function WipeDialog({ open, onClose, banks }: { open: boolean; onClose: () => void; banks: string }) {
  const router = useRouter();
  const id = useId();
  const [confirmText, setConfirmText] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [wiping, setWiping] = useState(false);

  const close = useCallback(() => {
    onClose();
    setConfirmText("");
    setCurrentPassword("");
    setError(null);
  }, [onClose]);

  const canSubmit = confirmText === CONFIRM_PHRASE && currentPassword.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setWiping(true);
    setError(null);
    try {
      const res = await fetch("/api/account/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't wipe your data. Nothing was deleted. Try again.");
        return;
      }
      close();
      showToast("All data wiped");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Couldn't reach Tally. Nothing was deleted. Check your connection and try again.");
    } finally {
      setWiping(false);
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy={`${id}-title`} dismissible={!wiping} busy={wiping}>
      <form onSubmit={submit}>
        <DialogBody>
          <DialogHeader
            tile={<DialogTile tone="negative"><AlertTriangle size={20} strokeWidth={1.75} /></DialogTile>}
            titleId={`${id}-title`}
            title="Wipe all data?"
            subtitle="This can't be undone"
            onClose={wiping ? undefined : close}
          />
          <p className="m-0 text-[15px] leading-relaxed text-text-2">
            Tally disconnects {banks} and deletes every account, transaction, balance and holding stored for them. Your login stays: you&apos;ll land on an empty app, not get signed out.
          </p>
          {error && (
            <DialogNote tone="negative" role="alert" icon={<AlertTriangle size={16} strokeWidth={1.75} className="flex-none mt-0.5" />}>
              {error}
            </DialogNote>
          )}
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor={`${id}-phrase`}>
              Type {CONFIRM_PHRASE} to confirm
            </label>
            <input
              id={`${id}-phrase`}
              className={inputClass}
              value={confirmText}
              disabled={wiping}
              autoComplete="off"
              autoCapitalize="characters"
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor={`${id}-pw`}>
              Current password
            </label>
            <input
              id={`${id}-pw`}
              type="password"
              autoComplete="current-password"
              className={inputClass}
              value={currentPassword}
              disabled={wiping}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} disabled={wiping}>
            Cancel
          </Button>
          <Button type="submit" variant="destructive-solid" loading={wiping} disabled={!canSubmit}>
            Wipe everything
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
