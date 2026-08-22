import { db, schema } from "@/db";
import type { SyncTrigger } from "@/lib/plaidSync";

type SyncKind = (typeof schema.syncKindEnum.enumValues)[number];

/** Shared `sync_runs` bookkeeping (§8.2) for the M5 sync modules — mirrors the recorder already inlined in lib/plaidSync.ts. */
export async function recordSyncRun(
  itemId: string,
  kind: SyncKind,
  trigger: SyncTrigger,
  startedAt: Date,
  result: { added?: number; modified?: number; removed?: number; error?: string },
) {
  await db.insert(schema.syncRuns).values({
    itemId,
    kind,
    trigger,
    startedAt,
    finishedAt: new Date(),
    added: result.added ?? 0,
    modified: result.modified ?? 0,
    removed: result.removed ?? 0,
    error: result.error,
  });
}
