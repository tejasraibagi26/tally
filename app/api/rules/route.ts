import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { previewRuleMatchCount, applyRulesToExistingTransactions } from "@/lib/categorize";
import type { RuleMatch } from "@/lib/rulesEngine";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await db.select().from(schema.rules).where(eq(schema.rules.userId, userId)).orderBy(asc(schema.rules.priority));
  return NextResponse.json({ rules });
}

const matchSchema = z.object({
  field: z.enum(["description", "merchant", "amount", "account", "pfc_primary", "pfc_detailed", "direction"]),
  op: z.enum(["contains", "regex", "equals", "gte", "lte", "between", "in"]),
  value: z.union([z.string(), z.number(), z.tuple([z.number(), z.number()]), z.array(z.string())]),
});

const actionsSchema = z.object({
  setCategoryId: z.string().uuid().optional(),
  addTag: z.string().min(1).max(40).optional(),
  exclude: z.boolean().optional(),
  markTransfer: z.boolean().optional(),
  split: z.array(z.object({ categoryId: z.string().uuid(), amount: z.number().int() })).optional(),
});

const createSchema = z.object({
  priority: z.number().int().default(0),
  enabled: z.boolean().default(true),
  match: matchSchema,
  actions: actionsSchema,
  applyToExisting: z.boolean().default(false),
});

// §7.2: "every rule offers apply to existing transactions with a preview
// count before it commits" — ?preview=1 evaluates `match` against the
// user's current transactions and returns the count without creating
// anything; without it, the rule is created (and applied, if requested).
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const preview = new URL(req.url).searchParams.get("preview") === "1";

  if (preview) {
    const matchParsed = matchSchema.safeParse(body?.match);
    if (!matchParsed.success) {
      return NextResponse.json({ error: "Invalid match", issues: matchParsed.error.issues }, { status: 400 });
    }
    const previewCount = await previewRuleMatchCount(userId, matchParsed.data as RuleMatch);
    return NextResponse.json({ previewCount });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { priority, enabled, match, actions, applyToExisting } = parsed.data;

  const [rule] = await db
    .insert(schema.rules)
    .values({ userId, priority, enabled, match, actions, appliesToExisting: applyToExisting })
    .returning();

  if (applyToExisting) {
    await applyRulesToExistingTransactions(userId);
  }

  return NextResponse.json({ rule });
}
