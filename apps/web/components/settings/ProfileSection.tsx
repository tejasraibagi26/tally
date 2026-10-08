"use client";

import { useCallback, useId, useState, type FormEvent } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DialogBody, DialogFooter, DialogHeader, DialogTile } from "@/components/ui/Dialog";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsLayout";
import { showToast } from "@/lib/toast";

const inputClass =
  "h-9 w-full rounded-control border border-border-strong bg-surface px-3 text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-info disabled:opacity-60";
const labelClass = "text-xs font-medium text-text-2";

function longDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} role="alert" className="m-0 flex items-start gap-1.5 text-[13px] text-negative">
      <AlertTriangle size={14} strokeWidth={1.75} className="flex-none mt-0.5" />
      {children}
    </p>
  );
}

/**
 * Settings' Profile and Security groups: rows that show the current values,
 * with each change made in its own dialog (both need the current password,
 * as before). An email or password change signs you out, since both live in
 * the JWT session.
 */
export function ProfileSection({ name, email, birthDate }: { name: string; email: string; birthDate: string | null }) {
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  return (
    <>
      <SettingsGroup id="profile" title="Profile">
        <SettingsRow title="Name">
          <span className="text-[14px] text-text-2">{name || "Not set"}</span>
        </SettingsRow>
        <SettingsRow title="Email" description="For signing in and every email Tally sends">
          <span className="text-[14px] text-text-2 truncate max-w-[260px]">{email}</span>
        </SettingsRow>
        <SettingsRow title="Birth date" description="Lets the early-retirement planner show the age you'd reach it">
          <span className="text-[14px] text-text-2 tabular-nums">{birthDate ? longDate(birthDate) : "Not set"}</span>
        </SettingsRow>
        <div className="flex justify-end px-[18px] py-3">
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-haspopup="dialog">
            Edit profile
          </Button>
        </div>
      </SettingsGroup>

      <SettingsGroup id="security" title="Security">
        <SettingsRow title="Password" description="Changing it signs you out so you can sign in with the new one">
          <Button variant="secondary" size="sm" onClick={() => setChangingPassword(true)} aria-haspopup="dialog">
            Change password
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <EditProfileDialog open={editing} onClose={() => setEditing(false)} initial={{ name, email, birthDate: birthDate ?? "" }} />
      <PasswordDialog open={changingPassword} onClose={() => setChangingPassword(false)} />
    </>
  );
}

function EditProfileDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: { name: string; email: string; birthDate: string } }) {
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = useCallback(() => {
    onClose();
    setName(initial.name);
    setEmail(initial.email);
    setBirthDate(initial.birthDate);
    setCurrentPassword("");
    setError(null);
  }, [onClose, initial]);

  const hasChanges = name !== initial.name || email !== initial.email || birthDate !== initial.birthDate;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, birthDate: birthDate || null, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save your profile. Try again.");
        return;
      }
      if (data.emailChanged) {
        // Email is embedded in the JWT session token at sign-in — force a
        // fresh login so the session reflects what's actually in the DB.
        await signOut({ callbackUrl: "/login" });
        return;
      }
      onClose();
      setCurrentPassword("");
      showToast("Profile saved");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Couldn't reach Tally. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy={`${id}-title`} dismissible={!saving} busy={saving}>
      <form onSubmit={submit}>
        <DialogBody>
          <DialogHeader
            tile={<DialogTile tone="neutral"><UserRound size={20} strokeWidth={1.75} /></DialogTile>}
            titleId={`${id}-title`}
            title="Edit profile"
            subtitle={email !== initial.email ? "Changing your email signs you out" : "Saving needs your current password"}
            onClose={saving ? undefined : close}
          />
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor={`${id}-name`}>Name</label>
            <input id={`${id}-name`} className={inputClass} value={name} disabled={saving} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor={`${id}-email`}>Email</label>
            <input id={`${id}-email`} type="email" required className={inputClass} value={email} disabled={saving} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor={`${id}-birth`}>Birth date <span className="font-normal text-text-3">(optional)</span></label>
            <input id={`${id}-birth`} type="date" className={inputClass} value={birthDate} disabled={saving} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor={`${id}-pw`}>Current password</label>
            <input
              id={`${id}-pw`}
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
              value={currentPassword}
              disabled={saving}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-err` : undefined}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!hasChanges || !currentPassword}>
            Save profile
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const id = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = useCallback(() => {
    onClose();
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  }, [onClose]);

  const tooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const canSave = currentPassword.length > 0 && newPassword.length >= 8 && confirmPassword === newPassword;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't change your password. Try again.");
        setSaving(false);
        return;
      }
      // No server-side session store to revoke under the JWT strategy —
      // force a fresh sign-in with the new password instead.
      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      console.error(err);
      setError("Couldn't reach Tally. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy={`${id}-title`} dismissible={!saving} busy={saving}>
      <form onSubmit={submit}>
        <DialogBody>
          <DialogHeader
            tile={<DialogTile tone="neutral"><KeyRound size={20} strokeWidth={1.75} /></DialogTile>}
            titleId={`${id}-title`}
            title="Change password"
            subtitle="You'll sign in again with the new one"
            onClose={saving ? undefined : close}
          />
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor={`${id}-cur`}>Current password</label>
            <input
              id={`${id}-cur`}
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
              value={currentPassword}
              disabled={saving}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-err` : undefined}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            {error && <FieldError id={`${id}-err`}>{error}</FieldError>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor={`${id}-new`}>New password</label>
            <input
              id={`${id}-new`}
              type="password"
              required
              autoComplete="new-password"
              className={inputClass}
              value={newPassword}
              disabled={saving}
              aria-describedby={`${id}-hint`}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <span id={`${id}-hint`} className={tooShort ? "text-[13px] text-negative" : "text-[13px] text-text-3"}>
              At least 8 characters
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor={`${id}-conf`}>Confirm new password</label>
            <input
              id={`${id}-conf`}
              type="password"
              required
              autoComplete="new-password"
              className={inputClass}
              value={confirmPassword}
              disabled={saving}
              aria-invalid={mismatch || undefined}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {mismatch && <FieldError id={`${id}-mm`}>The two new passwords don't match.</FieldError>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!canSave}>
            Change password
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  );
}
