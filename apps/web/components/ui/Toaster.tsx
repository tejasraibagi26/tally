"use client";

import { useEffect, useState } from "react";
import { TOAST_EVENT, type ToastDetail } from "@/lib/toast";
import { cn } from "@/lib/cn";

const TOAST_MS = 4000;

/** Renders lib/toast.ts's showToast(). Mounted once, in the app layout. */
export function Toaster() {
  const [toast, setToast] = useState<(ToastDetail & { id: number }) | null>(null);

  useEffect(() => {
    function onToast(e: Event) {
      setToast({ ...(e as CustomEvent<ToastDetail>).detail, id: Date.now() });
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div role="status" aria-live="polite" className="fixed right-6 bottom-6 z-[60] max-w-[calc(100vw-32px)]">
      {toast && (
        <div
          key={toast.id}
          className="flex items-center gap-2.5 rounded-control bg-raised border border-border shadow-overlay px-4 py-2.5 text-[13.5px] text-text animate-[fade-in_180ms_ease-out] motion-reduce:animate-none"
        >
          <span className={cn("w-1.5 h-1.5 flex-none rounded-full", toast.tone === "negative" ? "bg-negative" : "bg-positive")} />
          {toast.message}
        </div>
      )}
    </div>
  );
}
