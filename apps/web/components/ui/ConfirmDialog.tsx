"use client";

import { useId, useRef, type ReactNode } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DialogBody, DialogFooter, DialogHeader, DialogNote, DialogTile } from "@/components/ui/Dialog";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  icon,
  description,
  confirmLabel = "Confirm",
  confirming = false,
  destructive = true,
  error = null,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  /** Goes in the header tile; defaults to a warning triangle (destructive) or a question mark. */
  icon?: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  confirming?: boolean;
  destructive?: boolean;
  /** Shown in place of the description after a failed confirm; the confirm button becomes "Try again". */
  error?: string | null;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      dismissible={!confirming}
      busy={confirming}
      labelledBy={titleId}
      // Enter on a destructive confirm should never delete by accident.
      initialFocusRef={destructive ? cancelRef : undefined}
    >
      <DialogBody>
        <DialogHeader
          tile={
            <DialogTile tone={destructive ? "negative" : "brand"}>
              {icon ?? (destructive ? <AlertTriangle size={20} strokeWidth={1.75} /> : <HelpCircle size={20} strokeWidth={1.75} />)}
            </DialogTile>
          }
          titleId={titleId}
          title={title}
          subtitle={subtitle}
          onClose={confirming ? undefined : onClose}
        />
        {error ? (
          <DialogNote tone="negative" role="alert" icon={<AlertTriangle size={16} strokeWidth={1.75} className="flex-none mt-0.5" />}>
            {error}
          </DialogNote>
        ) : (
          <div className="text-[15px] text-text-2 leading-relaxed flex flex-col gap-3">{description}</div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button ref={cancelRef} type="button" variant="ghost" onClick={onClose} disabled={confirming}>
          Cancel
        </Button>
        <Button type="button" variant={destructive ? "destructive-solid" : "primary"} onClick={onConfirm} loading={confirming}>
          {error ? "Try again" : confirmLabel}
        </Button>
      </DialogFooter>
    </Modal>
  );
}
