import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { auth } from "@/lib/auth";
import { prefersGoalView } from "@/lib/goalView";

// Self-hosted (app/fonts, Latin subset, SIL OFL) rather than next/font/google:
// fetching from Google at build time failed intermittently ("An error occurred
// in next/font", seen on Vercel and in CI), and with CI gating deploys a
// flaky fetch would block releases. Same families, weights, CSS variables and
// display/preload settings as before; each is one variable file.
const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  weight: "400 600",
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-var.woff2",
  weight: "400 500",
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Tally Pop's fonts: the UI face and the display face.
const figtree = localFont({
  src: "./fonts/figtree-latin-var.woff2",
  weight: "400 800",
  variable: "--font-figtree",
  display: "swap",
});

const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin-var.woff2",
  // 400 upward because the quiet skin (globals.css, data-skin="quiet") sets
  // display text at 500; Pop itself still asks for 800.
  weight: "400 800",
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tally",
  description: "Every dollar, counted. A private finance dashboard that keeps track of it all.",
};

// Runs before first paint so the page never renders light and then flips to
// dark a beat later. The server always emits data-theme="light" below (no
// way to know the visitor's preference at request time); this blocking,
// non-deferred script corrects it synchronously, before the browser paints
// anything, mirroring the same storage key and fallback lib/theme.ts uses.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("tally-theme");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

// Same reasoning as THEME_INIT_SCRIPT, but the stakes are the opposite way
// round: if this ran late, every dollar figure would flash on screen for a
// beat before blurring — defeating the point of a privacy toggle — so it
// must run synchronously before first paint too.
const PRIVACY_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("tally-hide-amounts");document.documentElement.setAttribute("data-hide-amounts",s==="true"?"true":"false");}catch(e){}})();`;

// components/BootSplash.tsx plays once per tab session. Marking <html>
// before first paint, rather than after hydration, keeps a reload from
// flashing the splash for a frame. Reduced motion skips it outright.
const BOOT_INIT_SCRIPT = `(function(){try{if(sessionStorage.getItem("tally-booted")||window.matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.setAttribute("data-booted","");}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts's per-request CSP nonce. Reading headers() also makes every
  // page render per request, which a nonce needs: a prerendered page would
  // carry a stale one the CSP refuses.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // The quiet skin rides the goal-view opt-in (lib/goalView.ts). Read here
  // rather than in app/(app)/layout.tsx because it belongs on <html>, and
  // stamped server-side so the page never paints Pop and then flips.
  const session = await auth().catch(() => null);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const quiet = userId ? await prefersGoalView(userId).catch(() => false) : false;
  return (
    <html lang="en" data-theme="light" data-ui="pop" data-skin={quiet ? "quiet" : undefined} data-hide-amounts="false" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PRIVACY_INIT_SCRIPT }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOT_INIT_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${figtree.variable} ${bricolage.variable} font-ui antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
