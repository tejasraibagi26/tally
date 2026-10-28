"use client";

import { useEffect } from "react";
import { appSchemeUrl } from "@tally/core/appLinks";
import { LogoMark } from "@/components/Logo";

/** Tries the app once on arrival; the button is there for email apps that block the automatic hand-off. */
export function OpenInApp({ to }: { to: string }) {
  const app = appSchemeUrl(to);
  useEffect(() => {
    window.location.href = app;
  }, [app]);

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-[360px] flex flex-col items-center gap-5 text-center">
        <LogoMark size={44} />
        <div className="flex flex-col gap-1.5">
          <h1 className="ui-page-title m-0 text-2xl font-semibold text-text">Opening Tally…</h1>
          <p className="m-0 text-[14.5px] text-text-2">If the app didn&apos;t open, tap below. iPhone asks the first time.</p>
        </div>
        <a href={app} className="ui-btn ui-btn-primary w-full h-12 inline-flex items-center justify-center rounded-control bg-brand text-on-brand text-[16px] font-semibold">
          Open in the Tally app
        </a>
        <a href={to} className="text-[14.5px] font-medium text-brand">
          Continue in browser
        </a>
      </div>
    </main>
  );
}
