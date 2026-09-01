"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

/** Removes a manually-added bill (AddBillForm's "+ Add a bill") — the only
 * kind of recurringStreams row this is allowed for; an auto-detected stream
 * has no delete route since it'd just reappear on the next sync. */
export function RemoveBillButton({ streamId, description }: { streamId: string; description: string }) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function remove() {
    if (!window.confirm(`Remove "${description}"? Transactions it already posted stay in your history.`)) return;
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
