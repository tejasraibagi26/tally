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
