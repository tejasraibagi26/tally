"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface ConfirmRequest {
  title: string;
  subtitle?: string;
  description: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  /** Shown in the dialog if `run` throws; the dialog stays open on "Try again". */
  failure: string;
  /** The action itself. Throw to keep the dialog open with `failure`. */
  run: () => Promise<void>;
}

/**
 * Replaces window.confirm for a one-off "are you sure?": confirm({...}) opens
 * a ConfirmDialog that runs the action in place, with a spinner on the
 * button while it runs and the failure shown inline if it throws. Render
 * `dialog` somewhere in the component.
 */
export function useConfirmAction() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = useCallback((req: ConfirmRequest) => {
    setError(null);
    setRequest(req);
  }, []);

  async function onConfirm() {
    if (!request) return;
    setRunning(true);
    setError(null);
    try {
      await request.run();
      setRequest(null);
    } catch (err) {
      console.error(err);
      setError(request.failure);
    } finally {
      setRunning(false);
    }
  }

  const dialog = (
    <ConfirmDialog
      open={request !== null}
      onClose={() => setRequest(null)}
      onConfirm={() => void onConfirm()}
      title={request?.title ?? ""}
      subtitle={request?.subtitle}
      description={request?.description ?? null}
      confirmLabel={request?.confirmLabel}
      destructive={request?.destructive ?? true}
      confirming={running}
      error={error}
    />
  );

  return { confirm, dialog };
}
