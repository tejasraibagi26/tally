"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DialogBody, DialogFooter, DialogHeader, DialogTile } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { isPopOn } from "@/lib/uiFlag";

/**
 * The one-time announcement of year-end goals (Tally Pop only), on Overview.
 * Shows once per account: either button records it (POST /api/goals/intro).
 * "Not now" just closes -- Overview's "Set a goal for the year" card stays
 * until a goal exists, so dismissing never loses the way in.
 */
export function GoalIntroModal({ show }: { show: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Pop is a browser cookie, so this decides after mount.
  useEffect(() => {
    if (show && isPopOn()) setOpen(true);
  }, [show]);

  function dismiss(then?: () => void) {
    setOpen(false);
    fetch("/api/goals/intro", { method: "POST" }).catch(() => {});
    then?.();
  }

  return (
    <Modal open={open} onClose={() => dismiss()} labelledBy="goal-intro-title">
      <DialogBody>
        <DialogHeader
          tile={<DialogTile tone="brand"><Target size={20} strokeWidth={2} /></DialogTile>}
          title="New: year-end goals"
          titleId="goal-intro-title"
          subtitle="Pick a net worth to reach by Dec 31."
          onClose={() => dismiss()}
        />
        <ul className="m-0 pl-5 flex flex-col gap-2 text-[15px] leading-relaxed text-text">
          <li>Tally projects where your net worth lands from how fast it grew over the last 3 months.</li>
          <li>It tells you whether you&apos;re on track, and if not, how much more a month closes the gap.</li>
          <li>When you&apos;re behind, it points to the spending categories with the most room.</li>
        </ul>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={() => dismiss()}>
          Not now
        </Button>
        <Button onClick={() => dismiss(() => router.push("/goals"))}>Set a goal</Button>
      </DialogFooter>
    </Modal>
  );
}
