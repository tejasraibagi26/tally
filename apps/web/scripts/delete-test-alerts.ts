import "dotenv/config";
import { sql } from "drizzle-orm";
import { db, schema } from "../db";

/**
 * Deletes every alert sent by the removed Settings → "Send a test alert"
 * feature (alert_events rows with payload.test = true), so they drop out of
 * Recent alerts. Real alerts are untouched. Safe to re-run.
 *
 *   npm run alerts:delete-tests              # delete
 *   npm run alerts:delete-tests -- --dry-run # count only
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const isTest = sql`coalesce((${schema.alertEvents.payload}->>'test')::boolean, false) = true`;

  const rows = await db
    .select({ id: schema.alertEvents.id, title: schema.alertEvents.title, createdAt: schema.alertEvents.createdAt })
    .from(schema.alertEvents)
    .where(isTest);

  console.log(`${rows.length} test alert(s) found.`);
  for (const r of rows) console.log(`  ${r.createdAt.toISOString()}  ${r.title}`);

  if (dryRun || rows.length === 0) {
    if (dryRun) console.log("Dry run: nothing deleted.");
    return;
  }

  const deleted = await db.delete(schema.alertEvents).where(isTest).returning({ id: schema.alertEvents.id });
  console.log(`Deleted ${deleted.length} test alert(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
