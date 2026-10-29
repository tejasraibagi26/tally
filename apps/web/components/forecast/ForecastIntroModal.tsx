"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { DialogBody, DialogFooter, DialogHeader, DialogTile } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { isPopOn } from "@/lib/uiFlag";

/**
 * The one-time announcement of Forecast (Tally Pop only), on Overview.
 * Shows once per account: either button records it (POST
 * /api/announcements/seen, key "forecast"). "Not now" just closes — the
 * sidebar entry and the Overview card stay, so dismissing never loses the
 * way in.
 */
export function ForecastIntroModal({ show }: { show: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Pop is a browser cookie, so this decides after mount.
  useEffect(() => {
    if (show && isPopOn()) setOpen(true);
  }, [show]);

  function dismiss(then?: () => void) {
    setOpen(false);
    fetch("/api/announcements/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "forecast" }),
    }).catch(() => {});
    then?.();
  }

  return (
    <Modal open={open} onClose={() => dismiss()} labelledBy="forecast-intro-title">
      <DialogBody>
        <DialogHeader
          tile={<DialogTile tone="brand"><TrendingDown size={20} strokeWidth={2} /></DialogTile>}
          title="New: Forecast"
          titleId="forecast-intro-title"
          subtitle="See where your balance is heading for the next 60 days."
          onClose={() => dismiss()}
        />
        <ul className="m-0 pl-5 flex flex-col gap-2 text-[15px] leading-relaxed text-text">
          <li>Tally plots your balance day by day from your pay dates, your bills and your card statements.</li>
          <li>It leads with the first day you&apos;d drop below your buffer — and what put you there.</li>
          <li>Day-to-day spending is the one estimate, so it&apos;s drawn as a range you can adjust.</li>
        </ul>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={() => dismiss()}>
          Not now
        </Button>
        <Button onClick={() => dismiss(() => router.push("/forecast"))}>See the forecast</Button>
      </DialogFooter>
    </Modal>
  );
}
