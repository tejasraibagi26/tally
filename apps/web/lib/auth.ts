import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { authConfig } from "@/lib/auth.config";
import { authenticateCredentials } from "@/lib/authenticateCredentials";
import { DEMO_EMAIL, DEMO_PROVIDER_ID } from "@/lib/demo";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await authenticateCredentials(email, password);
        if (!user) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),

    /**
     * Passwordless sign-in for the public read-only demo (lib/demo.ts).
     * Deliberately takes no credentials: the demo account's password hash is
     * random and unknown to anyone, so this provider is the *only* way into
     * it — which is what makes the `demo: true` token claim, and the
     * read-only rule keyed off it, impossible to sidestep by signing in
     * through the normal form or the mobile login route instead.
     *
     * Returns null unless the demo account has actually been seeded, which
     * is the only switch the demo has: an instance that never ran
     * `npm run seed:demo` has no extra way in at all.
     */
    Credentials({
      id: DEMO_PROVIDER_ID,
      name: "Demo",
      credentials: {},
      async authorize() {
        const [user] = await db
          .select({ id: schema.users.id, email: schema.users.email, name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.email, DEMO_EMAIL))
          .limit(1);
        if (!user) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
});
