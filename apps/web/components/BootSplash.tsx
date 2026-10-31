"use client";

import { useEffect, useState } from "react";
import { TALLY_STROKES } from "@/components/Logo";

/** When the fade starts: one full draw (~1.0s) plus a short hold. */
const HOLD_MS = 1250;
/** Matches .boot-splash-out in globals.css. */
const FADE_MS = 320;

/**
 * Mobile's BootSplash on web: the first time the app opens in a browser
 * session, the tally mark draws itself stroke by stroke, "Tally" fades in,
 * and the splash fades away. Pure CSS (globals.css .boot-splash), so it
 * plays from the server-rendered HTML before hydration.
 *
 * Once a session: the root layout's BOOT_INIT_SCRIPT sets data-booted on
 * <html> before first paint when this tab has already seen it (or the
 * visitor prefers reduced motion), and CSS hides it — no flash on reload.
 */
export function BootSplash() {
  const [phase, setPhase] = useState<"draw" | "out" | "gone">("draw");

  useEffect(() => {
    if (document.documentElement.hasAttribute("data-booted")) {
      setPhase("gone");
      return;
    }
    try {
      sessionStorage.setItem("tally-booted", "1");
    } catch {}
    const out = setTimeout(() => setPhase("out"), HOLD_MS);
    const gone = setTimeout(() => {
      document.documentElement.setAttribute("data-booted", "");
      setPhase("gone");
    }, HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;
  return (
    <div className={`boot-splash${phase === "out" ? " boot-splash-out" : ""}`} aria-hidden="true">
      <svg width="76" height="76" viewBox="0 0 24 24" fill="none">
        {TALLY_STROKES.map((l, i) => (
          <line key={i} {...l} pathLength={1} strokeLinecap="round" />
        ))}
      </svg>
      <span className="boot-splash-word font-display">Tally</span>
    </div>
  );
}
