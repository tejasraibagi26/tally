import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { previewRuleMatchCount, applyRulesToExistingTransactions } from "@/lib/categorize";
import type { RuleMatch } from "@/lib/rulesEngine";

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

const patchSchema = z.object({
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
  match: matchSchema.optional(),
  actions: actionsSchema.optional(),
  applyToExisting: z.boolean().optional(),
});

async function loadOwnedRule(userId: string, id: string) {
  const [rule] = await db.select().from(schema.rules).where(eq(schema.rules.id, id)).limit(1);
  if (!rule || rule.userId !== userId) return null;
  return rule;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await loadOwnedRule(userId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const preview = new URL(req.url).searchParams.get("preview") === "1";

  if (preview) {
    const matchParsed = matchSchema.safeParse(body?.match ?? existing.match);
    if (!matchParsed.success) {
      return NextResponse.json({ error: "Invalid match", issues: matchParsed.error.issues }, { status: 400 });
    }
    const previewCount = await previewRuleMatchCount(userId, matchParsed.data as RuleMatch);
    return NextResponse.json({ previewCount });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { applyToExisting, ...fields } = parsed.data;
  if (Object.keys(fields).length === 0 && !applyToExisting) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [rule] = Object.keys(fields).length > 0
    ? await db.update(schema.rules).set(fields).where(eq(schema.rules.id, id)).returning()
    : [existing];

  if (applyToExisting) {
    await applyRulesToExistingTransactions(userId);
  }

  return NextResponse.json({ rule });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await loadOwnedRule(userId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(schema.rules).where(eq(schema.rules.id, id));
  return NextResponse.json({ ok: true });
}
