import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-runtime middleware: only the provider-less config, so bcrypt/postgres
// (Node-only) never get bundled here. Real authorization happens per-request
// in route handlers and server components via lib/auth.ts.
//
// It does two jobs on every page and API request:
// 1. The session gate: anything not public needs a session (or, for /api,
//    an Authorization header the route verifies itself). Handing NextAuth a
//    handler below means it no longer redirects on its own -- only a
//    Response from `authorized` (the demo's read-only 403) short-circuits --
//    so the gate lives here, in requiresSession().
// 2. A per-request CSP nonce for pages. Next.js reads it from the request's
//    Content-Security-Policy header and stamps its own scripts with it;
//    app/layout.tsx stamps the inline init scripts. 'strict-dynamic' lets
//    those scripts load what they load (Plaid Link injects its own).

/**
 * Paths reachable with no session at all, as prefixes after the leading
 * "/" -- the same set the matcher used to exclude:
 * - "" exactly: the marketing homepage (app/page.tsx), which redirects
 *   signed-in users itself. "docs", "privacy": public pages, no user data.
 * - "login"; "demo", the read-only demo's entry (app/demo/route.ts), which
 *   creates the session; "open", the email link hand-off.
 * - "api/auth": NextAuth and the mobile token routes. "api/plaid/webhook"
 *   (Plaid's signature) and "api/cron" (CRON_SECRET / QStash) carry their
 *   own auth.
 * - "email-change" and "unsubscribe" are the pages an email's link opens,
 *   and "api/account/email/confirm" / "api/email/unsubscribe" what their
 *   buttons post to; the signed token in the link is the auth.
 */
const PUBLIC_PREFIXES = [
  "api/auth",
  "api/plaid/webhook",
  "api/cron",
  "api/email/unsubscribe",
  "api/account/email/confirm",
  "email-change",
  "unsubscribe",
  "login",
  "demo",
  "docs",
  "privacy",
  "open",
];

function requiresSession(pathname: string): boolean {
  const path = pathname.slice(1);
  if (path === "") return false;
  return !PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

function contentSecurityPolicy(nonce: string): string {
  // Dev needs eval for React Refresh; production never does.
  const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  return [
    // 'unsafe-inline' and https: are fallbacks for browsers without CSP3;
    // any browser that understands the nonce ignores both.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'${devEval}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Mobile has no session cookie: let a request carrying an Authorization
  // header through to the route, which verifies it (requireUserId).
  if (requiresSession(pathname) && !req.auth?.user && !(isApi && req.headers.get("authorization"))) {
    if (isApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const signIn = new URL("/login", req.nextUrl);
    signIn.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signIn);
  }

  if (isApi) return NextResponse.next();

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}) as unknown as (req: NextRequest) => Promise<Response>;

export const config = {
  // Everything but build assets and plain static files (no session or
  // nonce needed to serve an icon).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
