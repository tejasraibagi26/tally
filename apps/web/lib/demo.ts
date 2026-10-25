/**
 * Public read-only demo mode.
 *
 * Distinct from MOCK_MODE (lib/config.ts), which is a *developer* convenience
 * — it swaps Plaid out for canned fixtures so a local clone runs with no
 * credentials, but the signed-in user is still a real user with full write
 * access. DEMO_MODE is a *product* feature: it lets an anonymous visitor sign
 * in as one dedicated, pre-seeded user and look around without being able to
 * change anything.
 *
 * This module is imported by middleware.ts (Edge runtime) via
 * lib/auth.config.ts, so it must stay free of node/db/bcrypt imports —
 * process.env reads and pure logic only.
 */

/** Opt-in, in every environment: a demo user is only reachable if this is on. */
export const DEMO_MODE: boolean = process.env.DEMO_MODE === "true";

/**
 * The one account the demo signs into. Seeded by `npm run seed:demo`, whose
 * data is disposable — the seed script re-generates it from scratch, so
 * anything a visitor somehow manages to change is not a real loss. It is
 * still read-only on every path below; this is the backstop, not the gate.
 *
 * The `.invalid` TLD is reserved by IANA and can never resolve, which is the
 * point: `seed:demo` resets by *deleting* this account, so the address must
 * be one no real person could plausibly have signed up with. (An earlier
 * draft used demo@tally.local and collided with a real local admin account
 * that happened to use it — hence the deliberately unusable domain.)
 */
export const DEMO_EMAIL = "demo@tally-demo.invalid";

/**
 * NextAuth provider id for the passwordless demo sign-in (lib/auth.ts). The
 * jwt callback stamps `demo: true` on the token when a session comes from
 * this provider, which is what every read-only check below keys off.
 */
export const DEMO_PROVIDER_ID = "demo";

/** HTTP methods that can't change anything, so the demo may use them freely. */
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Paths a demo session must keep full access to even for non-GET requests:
 * signing out of the demo is itself a POST to /api/auth/signout, and blocking
 * it would trap the visitor in a session they can't leave.
 */
const ALWAYS_ALLOWED_PREFIXES = ["/api/auth/"];

export function isWriteRequest(method: string): boolean {
  return !READ_ONLY_METHODS.has(method.toUpperCase());
}

/** True if this demo-session request would change state and must be refused. */
export function isBlockedForDemo(method: string, pathname: string): boolean {
  if (!isWriteRequest(method)) return false;
  return !ALWAYS_ALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Machine-readable marker the client fetch interceptor matches on. */
export const DEMO_READ_ONLY_CODE = "DEMO_READ_ONLY";

export const DEMO_READ_ONLY_MESSAGE = "This is a read-only demo — changes aren't saved.";

export const demoReadOnlyBody = {
  error: DEMO_READ_ONLY_MESSAGE,
  code: DEMO_READ_ONLY_CODE,
} as const;
