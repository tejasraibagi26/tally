"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { runSync } from "@/lib/runSync";
import type { SyncProduct } from "@/lib/syncSteps";

interface SyncButtonProps {
  /** Which product(s) to sync, across every item the user owns — scoped to whatever this page actually shows, so a failure banner here never mentions data this page doesn't display. */
  products: SyncProduct[];
  label?: string;
}

/**
 * Doesn't block the page (DESIGN.md §8): the button shows a spinner beside
 * its label while the sync runs, success is a toast, and any failure goes
 * to the page's persistent SyncFailureBanner (lib/runSync.ts).
 */
export function SyncButton({ products, label = "Sync now" }: SyncButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    await runSync(products);
    router.refresh();
    setLoading(false);
  }

  return (
    <Button variant="secondary" loading={loading} onClick={handleSync}>
      {label}
    </Button>
  );
}
