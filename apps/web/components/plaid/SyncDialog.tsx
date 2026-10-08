"use client";

import { useEffect, useId, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Clock, X, XCircle } from "lucide-react";
import {
  SYNC_SLOW_AFTER_MS,
  syncDialogCopy,
  syncSteps,
  type SyncDialogMode,
  type SyncDialogPhase,
} from "@tally/core/syncDialog";
import { Modal } from "@/components/ui/Modal";
import { DialogBody, DialogFooter, DialogHeader, DialogNote, DialogTile } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { TallyLoader } from "@/components/Logo";
import { cn } from "@/lib/cn";

export interface SyncDialogState {
  mode: SyncDialogMode;
  /** "slow" is derived here from startedAt, not stored. */
  phase: Exclude<SyncDialogPhase, "slow">;
  institutionName: string | null;
  /** Plaid account types picked in Link -- drives which step rows show. */
  accountTypes: string[];
  /** null while running. */
  failures: { product: string; label: string }[] | null;
  errorCode: string | null;
  /** Where a failure happened: inside Plaid Link, or saving afterwards. */
  errorStage: "link" | "save";
  startedAt: number;
}

function elapsedLabel(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The dialog for the stretch after Plaid Link closes: which bank, what's
 * being pulled, how long to expect, and how it ended. The tally mark writing
 * itself is the only progress indicator; on a result it gives way to the
 * result's icon in the same tile. Can't be dismissed while running.
 */
export function SyncDialog({ state, onClose, onRetry }: { state: SyncDialogState | null; onClose: () => void; onRetry: () => void }) {
  const titleId = useId();
  const [now, setNow] = useState(() => Date.now());
  // Keep the last state through the Modal's exit fade.
  const [shown, setShown] = useState(state);
  useEffect(() => {
    if (state) setShown(state);
  }, [state]);

  const running = state?.phase === "syncing";
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (!shown) return null;
  const s = state ?? shown;
  const elapsed = now - s.startedAt;
  const phase: SyncDialogPhase = s.phase === "syncing" && elapsed >= SYNC_SLOW_AFTER_MS ? "slow" : s.phase;
  const copy = syncDialogCopy({
    mode: s.mode,
    phase,
    institutionName: s.institutionName,
    accountCount: s.accountTypes.length,
    failureLabels: (s.failures ?? []).map((f) => f.label),
    errorCode: s.errorCode,
    errorStage: s.errorStage,
  });
  const steps = s.phase === "failed" ? [] : syncSteps(s.accountTypes, s.failures);
  const isRunning = phase === "syncing" || phase === "slow";
  const dismissible = !isRunning;

  const tile =
    phase === "syncing" ? (
      <DialogTile tone="brand"><TallyLoader /></DialogTile>
    ) : phase === "slow" ? (
      <DialogTile tone="warning"><TallyLoader slow /></DialogTile>
    ) : phase === "success" ? (
      <DialogTile tone="positive"><CheckCircle2 size={20} strokeWidth={1.75} /></DialogTile>
    ) : phase === "partial" ? (
      <DialogTile tone="warning"><AlertTriangle size={20} strokeWidth={1.75} /></DialogTile>
    ) : (
      <DialogTile tone="negative"><XCircle size={20} strokeWidth={1.75} /></DialogTile>
    );

  return (
    <Modal open={state !== null} onClose={onClose} dismissible={dismissible} labelledBy={titleId} busy={isRunning}>
      <DialogBody>
        <div aria-live="polite">
          <DialogHeader
            tile={tile}
            titleId={titleId}
            title={copy.title}
            subtitle={phase === "slow" ? `${copy.subtitle} · ${elapsedLabel(elapsed)}` : copy.subtitle}
            onClose={dismissible ? onClose : undefined}
          />
        </div>

        {steps.length > 0 && (
          <ul className="m-0 p-0 list-none flex flex-col rounded-[10px] border border-border bg-surface-2">
            {steps.map((row, i) => (
              <li key={row.key} className={cn("flex items-center gap-2.5 px-3 py-2.5 text-[13.5px] text-text", i > 0 && "border-t border-border")}>
                <span
                  className={cn(
                    "w-4 h-4 flex-none flex items-center justify-center",
                    row.status === "done" && "text-positive",
                    row.status === "failed" && "text-negative",
                  )}
                >
                  {row.status === "pending" ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-text-3" />
                  ) : row.status === "done" ? (
                    <Check size={16} strokeWidth={2} />
                  ) : (
                    <X size={16} strokeWidth={2} />
                  )}
                </span>
                {row.label}
                <span
                  className={cn(
                    "ml-auto text-[12.5px] whitespace-nowrap tabular-nums",
                    row.status === "failed" ? "text-negative" : row.status === "done" ? "text-positive" : "text-text-3",
                  )}
                >
                  {row.status === "failed" ? "Didn't come through" : row.detail ?? (row.status === "done" ? "Done" : "")}
                </span>
              </li>
            ))}
          </ul>
        )}

        {phase === "slow" && copy.body && (
          <DialogNote tone="neutral" icon={<Clock size={16} strokeWidth={1.75} className="flex-none mt-0.5" />}>
            {copy.body}
          </DialogNote>
        )}
        {(phase === "partial" || phase === "failed") && copy.body && <p className="m-0 text-[15px] leading-relaxed text-text-2">{copy.body}</p>}
      </DialogBody>

      {phase === "partial" && (
        <DialogFooter>
          <Button type="button" onClick={onClose} autoFocus>
            {s.mode === "create" ? "Go to accounts" : "Done"}
          </Button>
        </DialogFooter>
      )}
      {phase === "failed" && (
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onRetry} autoFocus>
            {s.mode === "update" && s.errorStage === "save" ? "Try sync again" : s.mode === "create" ? "Connect again" : "Sign in again"}
          </Button>
        </DialogFooter>
      )}
    </Modal>
  );
}
