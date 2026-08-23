import { db, schema } from "@/db";

/**
 * audit_log has existed in the schema since the initial migration but was
 * never actually written to anywhere — this is the first real writer.
 * `action` is "entity.verb" (e.g. "plaid_item.revoked"); `before`/`after`
 * are free-form snapshots for whatever the caller finds useful to keep, not
 * a full row diff.
 */
export async function recordAudit(entry: {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
  } catch (err) {
    // Never let audit logging itself break the action being audited.
    console.error(`Failed to record audit entry (${entry.action})`, err);
  }
}
