import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { DEMO_PROVIDER_ID } from "@/lib/demo";
import { isDemoAvailable } from "@/lib/demoAccount";

/**
 * `GET /demo` — the whole demo experience behind one shareable link.
 *
 * Signs the visitor into the pre-seeded read-only demo account server-side
 * and drops them straight on the Overview, so a link in a README, a tweet,
 * or a job application needs no sign-in step and no credentials to hand out.
 * The session it creates carries the `demo` claim, so middleware refuses
 * every write for its lifetime (lib/auth.config.ts).
 *
 * It's a GET, which means anything that can make this browser fetch a URL —
 * an <img> tag on another site — can trigger it. The guard below is what
 * keeps that from mattering: an already-signed-in visitor is never switched
 * into the demo, so the worst a forced hit can do to a real user is nothing.
 * For a signed-out visitor, landing in a read-only demo is the whole point.
 */
export async function GET() {
  // Nothing to offer if this instance never seeded a demo — don't hint
  // that it exists, just send them where a stranger belongs.
  if (!(await isDemoAvailable())) redirect("/");

  const session = await auth();
  if (session?.user) {
    // Already signed in — their own data, demo or real, is the better
    // destination than clobbering their session with the demo's.
    redirect("/overview");
  }

  // Throws the NEXT_REDIRECT that carries the new session cookie.
  await signIn(DEMO_PROVIDER_ID, { redirectTo: "/overview" });
}
