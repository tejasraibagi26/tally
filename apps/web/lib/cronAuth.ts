import { Receiver } from "@upstash/qstash";

/**
 * Vercel Cron Jobs (vercel.json) call the configured path with
 * `Authorization: Bearer $CRON_SECRET` automatically once CRON_SECRET is set
 * on the project — this just verifies that header so the endpoint can't be
 * triggered by anyone who finds the URL. Fails closed: no CRON_SECRET
 * configured means no request is ever authorized, not "allow everything".
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

let receiver: Receiver | null = null;

/**
 * Vercel Hobby caps native Cron Jobs at once/day — a schedule that needs to
 * fire more often (scripts/setup-qstash-schedule.ts: twice daily) runs on
 * Upstash QStash instead, which calls in as a normal signed POST rather than
 * through Vercel's own cron mechanism. Verifies the `Upstash-Signature`
 * header against QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY (both
 * checked, so a key rotation doesn't reject in-flight requests) — must be
 * called with the exact raw body string that was signed, not a re-serialized
 * one, or verification fails even for a genuine QStash request.
 */
export async function isAuthorizedQStashRequest(req: Request, rawBody: string): Promise<boolean> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return false;

  const signature = req.headers.get("upstash-signature");
  if (!signature) return false;

  if (!receiver) receiver = new Receiver({ currentSigningKey, nextSigningKey });

  try {
    return await receiver.verify({ signature, body: rawBody, url: req.url });
  } catch {
    return false;
  }
}
