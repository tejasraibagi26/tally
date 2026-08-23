"use client";

import { type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  confirming = false,
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  confirming?: boolean;
  destructive?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} width={480}>
      <div className="p-6 flex flex-col gap-4">
        <h2 className="font-display text-xl text-text m-0">{title}</h2>
        <div className="text-[15px] text-text-2 leading-relaxed flex flex-col gap-2">{description}</div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={confirming}>
            Cancel
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "primary"} onClick={onConfirm} disabled={confirming}>
            {confirming ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
