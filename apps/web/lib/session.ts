import { auth } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/mobileAuth";

/** Throws if unauthenticated. Every API route that touches user data calls this first.
 *
 * Accepts either NextAuth's cookie session (web) or an `Authorization: Bearer`
 * mobile access token (app/api/auth/mobile/*) — pass the route's `Request` so
 * the bearer path can read the header; omit it (as every page.tsx Server
 * Component does) to fall straight through to the cookie-only check. */
export async function requireUserId(req?: Request): Promise<string> {
  const authHeader = req?.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const userId = await verifyAccessToken(authHeader.slice(7));
    if (!userId) throw new Error("UNAUTHENTICATED");
    return userId;
  }

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error("UNAUTHENTICATED");
  return userId;
}
