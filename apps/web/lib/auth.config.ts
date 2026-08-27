import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the NextAuth config — no providers, no DB, no bcrypt.
 * middleware.ts runs on the Edge runtime and can only import this file;
 * lib/auth.ts (Node runtime) extends it with the Credentials provider.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth: session, request }) {
      if (session?.user) return true;
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
