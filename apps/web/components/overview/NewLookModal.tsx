"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DialogBody, DialogFooter, DialogHeader, DialogTile } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { applyUi, isPopOn } from "@/lib/uiFlag";

/**
 * The one-time announcement of Tally Pop becoming the default look (web
 * v2.2.0), on Overview. Shows once per account (lib/announcements.ts
 * "new-look"), and only to someone seeing Pop -- a classic opt-out already
 * knows. Either button records it; "Use the classic look" also does what the
 * side nav's "New look" switch does. The goals intro waits for the next visit.
 */
export function NewLookModal({ show }: { show: boolean }) {
  const [open, setOpen] = useState(false);

  // Pop is a browser cookie, so this decides after mount.
  useEffect(() => {
    if (show && isPopOn()) setOpen(true);
  }, [show]);

  function dismiss(classic = false) {
    setOpen(false);
    fetch("/api/announcements/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "new-look" }),
    }).catch(() => {});
    if (classic) {
      applyUi(false);
      fetch("/api/settings/ui-look", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ look: "classic" }),
      }).catch(() => {});
    }
  }

  return (
    <Modal open={open} onClose={() => dismiss()} labelledBy="new-look-title">
      <DialogBody>
        <DialogHeader
          tile={<DialogTile tone="brand"><Sparkles size={20} strokeWidth={2} /></DialogTile>}
          title="Tally has a new look"
          titleId="new-look-title"
          subtitle="Same numbers, more fun to check."
          onClose={() => dismiss()}
        />
        <ul className="m-0 pl-5 flex flex-col gap-2 text-[15px] leading-relaxed text-text">
          <li>Brighter colors, bolder type, and charts that run edge to edge.</li>
          <li>Your recap emails and the mobile app match it too.</li>
          <li>Prefer the old one? Turn off &ldquo;New look&rdquo; at the bottom of the sidebar any time.</li>
        </ul>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={() => dismiss(true)}>
          Use the classic look
        </Button>
        <Button onClick={() => dismiss()}>Looks good</Button>
      </DialogFooter>
    </Modal>
  );
}
