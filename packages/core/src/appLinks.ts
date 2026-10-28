/**
 * Links from email into the mobile app without universal links (no paid
 * Apple Developer account): emails point at the web's /open?to=<path>,
 * which tries tally://<path> on a phone and falls back to the web page;
 * the app's +native-intent maps that web path onto its own screens.
 */

/** A same-site path only: "/x", never "//host", a scheme or a backslash (no open redirect). */
export function isSafeAppPath(to: string | null | undefined): to is string {
  return typeof to === "string" && to.startsWith("/") && !to.startsWith("//") && !to.includes("\\") && !/^\/[a-z][a-z0-9+.-]*:/i.test(to);
}

/** The /open link an email uses for a web path: "/open?to=%2Fsubscriptions". */
export function openLinkPath(to: string): string {
  return `/open?to=${encodeURIComponent(to)}`;
}

/** tally://<path> for a web path: the app maps it with appPathForWebPath. */
export function appSchemeUrl(to: string): string {
  return `tally://${to.replace(/^\/+/, "")}`;
}

/**
 * Where a web path opens in the app. Tabs and screens that share a name
 * map as they are; the rest are translated (Overview is the app's home,
 * a transaction panel is its own screen, Settings' #alerts is a screen).
 */
export function appPathForWebPath(webPath: string): string {
  const url = new URL(webPath, "https://tally.invalid");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const q = url.searchParams;

  if (path === "/" || path === "/overview") return q.get("safe") ? "/?safe=1" : "/";
  if (path === "/transactions") {
    const tx = q.get("tx");
    return tx ? `/transactions/${encodeURIComponent(tx)}` : "/transactions";
  }
  if (path === "/cards") {
    const card = q.get("card");
    return card ? `/card/${encodeURIComponent(card)}` : "/cards";
  }
  if (path.startsWith("/tags/")) return `/tag/${path.slice("/tags/".length)}`;
  if (path === "/settings") return url.hash === "#alerts" ? "/alerts" : url.hash === "#safe-to-spend" ? "/safe-to-spend" : url.hash === "#income" ? "/income-schedules" : "/settings";
  if (path === "/year-in-review") return q.get("year") ? `/year-in-review?year=${q.get("year")}` : "/year-in-review";

  const same = ["/budgets", "/accounts", "/subscriptions", "/goals", "/investments", "/fire", "/tags", "/upcoming", "/alerts", "/safe-to-spend"];
  return same.includes(path) ? path : "/";
}
