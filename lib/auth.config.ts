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
    authorized({ auth: session }) {
      return Boolean(session?.user);
    },
  },
} satisfies NextAuthConfig;
