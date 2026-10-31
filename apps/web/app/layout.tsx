import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";

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

// Tally Pop preview fonts (lib/uiFlag.ts). preload: false so a browser
// without the flag never downloads them: the @font-face rules only fetch
// once something on the page actually uses the family.
const figtree = localFont({
  src: "./fonts/figtree-latin-var.woff2",
  weight: "400 800",
  variable: "--font-figtree",
  display: "swap",
  preload: false,
});

const bricolage = localFont({
  src: "./fonts/bricolage-grotesque-latin-var.woff2",
  weight: "700 800",
  variable: "--font-bricolage",
  display: "swap",
  preload: false,
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

// The look (lib/uiFlag.ts): Tally Pop unless this browser chose classic,
// set before first paint for the same no-flash reason as the theme. A
// classic choice also swaps the tab icon back once the head's icon links
// exist (app/icon.svg is Pop's).
const UI_INIT_SCRIPT = `(function(){try{if(/(?:^|; )tally-ui=classic(?:;|$)/.test(document.cookie)){document.addEventListener("DOMContentLoaded",function(){document.querySelectorAll('link[rel~="icon"]').forEach(function(l){l.dataset.popHref=l.href;l.href="/icon-classic.svg";});});}else{document.documentElement.setAttribute("data-ui","pop");}}catch(e){}})();`;

// components/BootSplash.tsx plays once per tab session. Marking <html>
// before first paint, rather than after hydration, keeps a reload from
// flashing the splash for a frame. Reduced motion skips it outright.
const BOOT_INIT_SCRIPT = `(function(){try{if(sessionStorage.getItem("tally-booted")||window.matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.setAttribute("data-booted","");}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts's per-request CSP nonce. Reading headers() also makes every
  // page render per request, which a nonce needs: a prerendered page would
  // carry a stale one the CSP refuses.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" data-theme="light" data-hide-amounts="false" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: PRIVACY_INIT_SCRIPT }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: UI_INIT_SCRIPT }} />
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
