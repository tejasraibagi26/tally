"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

/** Removes any recurringStreams row — a manually-added bill (AddBillForm's
 * "+ Add a bill") stays gone; an auto-detected stream can come back on the
 * next detectRecurringForUser run if its underlying transactions still
 * cluster the same way, so the confirm copy sets that expectation instead
 * of promising something the delete can't guarantee for that case. */
export function RemoveBillButton({ streamId, description, isManual }: { streamId: string; description: string; isManual: boolean }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    const warning = isManual
      ? `Remove "${description}"? Transactions it already posted stay in your history.`
      : `Remove "${description}"? Transactions it already posted stay in your history, but it may come back automatically if the same charge keeps recurring.`;
    if (!window.confirm(warning)) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/recurring-streams/${streamId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove bill");
      router.refresh();
    } catch (err) {
      console.error(err);
      setRemoving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void remove()}
      disabled={removing}
      title="Remove"
      aria-label="Remove"
      className="w-7 h-7 flex-none rounded-control flex items-center justify-center text-text-3 hover:text-negative hover:bg-negative-subtle disabled:opacity-40"
    >
      <Trash2 size={15} strokeWidth={1.75} />
    </button>
  );
}
