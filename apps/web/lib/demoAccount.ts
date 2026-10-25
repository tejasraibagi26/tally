import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEMO_EMAIL } from "@/lib/demo";

/**
 * Is there a demo to show? The demo is available exactly when the seeded
 * demo account exists (`npm run seed:demo`) — there's no env flag to set.
 *
 * That makes the state self-describing: the thing the demo needs in order to
 * work *is* the thing that switches it on, so it can't be enabled without
 * data behind it, or seeded but left switched off. `/demo` and the "Explore
 * the demo" buttons all read this, so an instance that never seeded shows no
 * demo door at all rather than a button that dead-ends.
 *
 * Node-only (it touches the DB), so it must never be imported into
 * lib/auth.config.ts, which middleware bundles for the Edge runtime. The
 * read-only gate there doesn't need this — it reads the session's own claim.
 *
 * Wrapped in React's cache() so a render that asks more than once (the page
 * plus a component inside it) still costs a single indexed lookup per
 * request. Not cached *across* requests on purpose: seeding the demo then
 * takes effect immediately, with no restart or revalidation step.
 */
export const isDemoAvailable = cache(async (): Promise<boolean> => {
  try {
    const [row] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, DEMO_EMAIL))
      .limit(1);
    return Boolean(row);
  } catch {
    // The marketing homepage and login page are the first thing a
    // misconfigured instance renders, and a missing/unmigrated database
    // shouldn't turn them into an error page over an optional button.
    return false;
  }
});
