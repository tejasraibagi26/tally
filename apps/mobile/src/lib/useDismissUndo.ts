import { useCallback, useState } from "react";
import { useRestoreSubscription } from "@/lib/queries/subscriptions";
import type { UpcomingBill } from "@/lib/queries/overview";

/**
 * The Undo toast after "This won't recur": remembers the last dismissed bill
 * and restores its stream (PATCH { dismissed: false }) if Undo is tapped.
 * Screens render <Toast message={undo.message} onHidden={undo.clear} action={undo.action} />.
 */
export function useDismissUndo() {
  const restore = useRestoreSubscription();
  const [last, setLast] = useState<UpcomingBill | null>(null);
  const clear = useCallback(() => setLast(null), []);
  return {
    onDismissed: setLast,
    message: last ? `${last.label} won't show again` : null,
    clear,
    action: last?.streamId ? { label: "Undo", onPress: () => restore.mutate(last.streamId!) } : undefined,
  };
}
