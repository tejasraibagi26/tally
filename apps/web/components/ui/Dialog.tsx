"use client";

import { type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The parts every Modal is built from: a header (40px icon tile, title,
 * optional subtitle, optional close), a body, and a footer with the
 * actions right-aligned and a hairline above. Keeps confirm, form and
 * progress dialogs on one anatomy.
 */

export type DialogTone = "brand" | "positive" | "warning" | "negative" | "neutral";

const toneClasses: Record<DialogTone, string> = {
  brand: "bg-brand-subtle text-brand",
  positive: "bg-positive-subtle text-positive",
  warning: "bg-warning-subtle text-warning",
  negative: "bg-negative-subtle text-negative",
  neutral: "bg-sunken text-text-2",
};

export function DialogTile({ tone, children }: { tone: DialogTone; children: ReactNode }) {
  return (
    <span className={cn("w-10 h-10 flex-none rounded-[10px] flex items-center justify-center transition-colors duration-150", toneClasses[tone])}>
      {children}
    </span>
  );
}

export function DialogHeader({
  tile,
  title,
  subtitle,
  titleId,
  onClose,
}: {
  /** The 40px tone tile; side panels leave it out. */
  tile?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  titleId?: string;
  /** Shows the close button; leave out while the dialog can't be dismissed. */
  onClose?: () => void;
}) {
  return (
    <div className="flex items-start gap-3.5">
      {tile}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <h2 id={titleId} className="m-0 text-lg font-semibold leading-snug text-text [text-wrap:balance]">
          {title}
        </h2>
        {subtitle && <p className="m-0 text-[13.5px] leading-normal text-text-2 tabular-nums">{subtitle}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-7 h-7 -mt-0.5 -mr-1.5 flex-none rounded-control flex items-center justify-center text-text-3 hover:text-text hover:bg-sunken"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

export function DialogBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-6 flex flex-col gap-4", className)}>{children}</div>;
}

export function DialogFooter({ children, left }: { children: ReactNode; left?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-border">
      {left && <div className="mr-auto">{left}</div>}
      {children}
    </div>
  );
}

/** Inline message inside a dialog body: an icon plus text on a tone-subtle fill. */
export function DialogNote({ tone, icon, children, role }: { tone: "warning" | "negative" | "neutral"; icon: ReactNode; children: ReactNode; role?: "alert" }) {
  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] leading-normal text-text-2",
        tone === "warning" && "bg-warning-subtle [&>svg]:text-warning",
        tone === "negative" && "bg-negative-subtle [&>svg]:text-negative",
        tone === "neutral" && "bg-surface-2 border border-border [&>svg]:text-text-3",
      )}
    >
      {icon}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
