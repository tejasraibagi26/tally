import { auth } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/mobileAuth";
import { isWriteRequest } from "@/lib/demo";

/** Throws if unauthenticated. Every API route that touches user data calls this first.
 *
 * Accepts either NextAuth's cookie session (web) or an `Authorization: Bearer`
 * mobile access token (app/api/auth/mobile/*) — pass the route's `Request` so
 * the bearer path can read the header; omit it (as every page.tsx Server
 * Component does) to fall straight through to the cookie-only check. */
export async function requireUserId(req?: Request): Promise<string> {
  const authHeader = req?.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    // A demo visitor can't reach this path: the demo account has no usable
    // password, so it can't mint a mobile token (lib/auth.ts).
    const userId = await verifyAccessToken(authHeader.slice(7));
    if (!userId) throw new Error("UNAUTHENTICATED");
    return userId;
  }

  const session = await auth();
  const user = session?.user as { id?: string; demo?: boolean } | undefined;
  const userId = user?.id;
  if (!userId) throw new Error("UNAUTHENTICATED");

  // Defence in depth behind middleware's read-only gate (lib/auth.config.ts),
  // which already refuses demo writes with a 403 before they get this far.
  // This is the backstop if a route is ever reachable without middleware —
  // it only has the method when a route handler passed its Request, which
  // Server Components never do (they can't write anyway).
  if (user?.demo && req && isWriteRequest(req.method)) throw new Error("DEMO_READ_ONLY");

  return userId;
}

/** True when the caller is browsing the public read-only demo. For Server
 *  Components that need to adapt the UI (hide write affordances, show the
 *  demo banner) rather than enforce — enforcement is middleware's job. */
export async function isDemoSession(): Promise<boolean> {
  const session = await auth();
  return (session?.user as { demo?: boolean } | undefined)?.demo === true;
}
