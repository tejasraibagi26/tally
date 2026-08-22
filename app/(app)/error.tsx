"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// DESIGN.md's empty-state convention (one line, one action, no illustration) applied to errors too.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App error boundary", error);
  }, [error]);

  return (
    <div className="max-w-[720px] mx-auto px-8 py-16">
      <Card className="p-10 flex flex-col items-center gap-3 text-center">
        <span className="font-display text-2xl text-text">Something went wrong</span>
        <p className="text-text-2 text-[15px]">
          That page hit an error loading its data. This didn't touch anything already saved.
        </p>
        {error.digest && <span className="font-mono text-xs text-text-3">Ref: {error.digest}</span>}
        <Button onClick={reset}>Try again</Button>
      </Card>
    </div>
  );
}
