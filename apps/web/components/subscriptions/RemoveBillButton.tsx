"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useConfirmAction } from "@/components/ui/useConfirmAction";

/** Removes any recurringStreams row — a manually-added bill (AddBillForm's
 * "+ Add a bill") is hard deleted, an auto-detected stream is soft-deleted
 * (dismissedAt), but either way it stays gone: detectRecurringForUser skips
 * reactivating a dismissed row even if the same charge keeps recurring. */
export function RemoveBillButton({ streamId, description }: { streamId: string; description: string }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmAction();

  function remove() {
    confirm({
      title: `Remove "${description}"?`,
      description: <p className="m-0">Transactions it already posted stay in your history.</p>,
      confirmLabel: "Remove bill",
      failure: "Couldn't remove this bill. Check your connection and try again.",
      run: async () => {
        const res = await fetch(`/api/recurring-streams/${streamId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to remove bill");
        router.refresh();
      },
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={remove}
        title="Remove"
        aria-label="Remove"
        aria-haspopup="dialog"
        className="w-7 h-7 flex-none rounded-control flex items-center justify-center text-text-3 hover:text-negative hover:bg-negative-subtle"
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
      {dialog}
    </>
  );
}
