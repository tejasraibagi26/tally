import { NextResponse } from "next/server";
import type { NextAuthConfig } from "next-auth";
import { DEMO_PROVIDER_ID, isBlockedForDemo, demoReadOnlyBody } from "@/lib/demo";

/**
 * Edge-safe half of the NextAuth config — no providers, no DB, no bcrypt.
 * middleware.ts runs on the Edge runtime and can only import this file;
 * lib/auth.ts (Node runtime) extends it with the Credentials providers.
 *
 * The jwt/session callbacks live here rather than in lib/auth.ts because
 * middleware needs them too: they're what put `userId` and `demo` on the
 * session, and `authorized` below can't enforce the demo's read-only rule
 * without reading `demo`. They're pure token-shuffling, so they're as
 * edge-safe as the rest of this file.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user?.id) token.userId = user.id;
      // `account` is only present on the sign-in pass, so this records how
      // the session was created once and then persists in the (signed,
      // httpOnly) token — a demo visitor can't flip it by editing a cookie.
      if (account) token.demo = account.provider === DEMO_PROVIDER_ID;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.userId) (session.user as { id?: string }).id = token.userId as string;
        (session.user as { demo?: boolean }).demo = token.demo === true;
      }
      return session;
    },
    authorized({ auth: session, request }) {
      const user = session?.user as { demo?: boolean } | undefined;

      // Read-only demo: refuse anything that could write, at the one gate
      // every mutation has to pass through. The app has no Server Actions —
      // every write is a non-GET request to /api/* — so this single check
      // covers all of them, including routes added later. Returning a
      // Response here (rather than a boolean) makes NextAuth send it as-is.
      if (user?.demo && isBlockedForDemo(request.method, request.nextUrl.pathname)) {
        return NextResponse.json(demoReadOnlyBody, { status: 403 });
      }

      if (user) return true;
      // No cookie session — let a request carrying an Authorization header
      // through to the route handler, which verifies it for real via
      // requireUserId() (lib/session.ts). Mobile has no session cookie at
      // all, so without this every mobile API call would be redirected to
      // /login here before its own bearer-token check ever runs. Page
      // routes never send this header, so this doesn't loosen their gate.
      return request.nextUrl.pathname.startsWith("/api/") && Boolean(request.headers.get("authorization"));
    },
  },
} satisfies NextAuthConfig;
