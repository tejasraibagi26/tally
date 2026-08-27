import "dotenv/config";
import { Client } from "@upstash/qstash";

/**
 * One-time (idempotent — re-run any time to update) setup: creates the
 * QStash recurring schedule for the twice-daily transactions safety net.
 * Vercel Hobby caps native Cron Jobs at once/day, so this one runs on
 * QStash instead (see lib/cronAuth.ts's isAuthorizedQStashRequest and
 * app/api/cron/sync-all/route.ts's POST handler) while the once-daily
 * nightly job stays a native Vercel Cron Job (vercel.json).
 *
 * Usage (needs QSTASH_TOKEN from the Upstash QStash integration, and the
 * app's real production URL):
 *   DOTENV_CONFIG_PATH=.env.production.local APP_URL=https://tally.useuplift.live npx tsx scripts/setup-qstash-schedule.ts
 */
const SCHEDULE_ID = "tally-sync-all-twice-daily";

async function main() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN is not set — pull it from the Upstash QStash Vercel integration first.");

  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("Set APP_URL to the deployed app's real URL, e.g. https://tally.useuplift.live");

  const client = new Client({ token });

  const { scheduleId } = await client.schedules.create({
    scheduleId: SCHEDULE_ID,
    destination: `${appUrl}/api/cron/sync-all`,
    cron: "0 10,22 * * *", // ≈6am/6pm Eastern; QStash schedules run in UTC same as Vercel Cron
    method: "POST",
  });

  console.log(`Schedule active: ${scheduleId}`);
  console.log("Check delivery logs at https://console.upstash.com/qstash");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
