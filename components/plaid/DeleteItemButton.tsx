"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteItemButton({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Disconnect this institution? Its accounts and transaction history will be removed.")) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove item");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      aria-label="Disconnect institution"
      className="text-text-3 hover:text-negative text-base disabled:opacity-40"
    >
      ⋯
    </button>
  );
}
