"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { FORECAST_HOW_IT_WORKS } from "@tally/core/forecast";
import { Modal } from "@/components/ui/Modal";
import { DialogBody, DialogFooter, DialogHeader, DialogTile } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

/**
 * "How it works" on the Forecast page: what the curve is built from and
 * which part of it is an estimate, opened on demand (the one-time
 * announcement is ForecastIntroModal). The words come from
 * @tally/core/forecast so mobile and the math say the same thing.
 */
export function ForecastHowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Info size={15} strokeWidth={2} aria-hidden />
        How it works
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="forecast-how-title">
        <DialogBody>
          <DialogHeader
            tile={<DialogTile tone="brand"><Info size={20} strokeWidth={2} /></DialogTile>}
            title="How the forecast works"
            titleId="forecast-how-title"
            subtitle="What Tally knows, what it estimates, and how to read the difference."
            onClose={() => setOpen(false)}
          />
          <ol className="m-0 p-0 list-none flex flex-col gap-4">
            {FORECAST_HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brand-subtle text-brand text-[13px] font-semibold flex items-center justify-center tabular">{i + 1}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold text-text">{step.title}</span>
                  <span className="text-[14px] leading-relaxed text-text-2">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </DialogFooter>
      </Modal>
    </>
  );
}
