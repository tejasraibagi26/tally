import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { eq, isNull, or } from "drizzle-orm";
import { requireUserId } from "@/lib/session";

// System categories (user_id null, seeded from Plaid's PFC taxonomy) plus
// this user's own additions — every category a user is allowed to see or use.
export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await db.query.categories.findMany({
    where: or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)),
    orderBy: (c, { asc }) => [asc(c.sortOrder), asc(c.name)],
  });

  return NextResponse.json({ categories });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().uuid().nullable().optional(),
  kind: z.enum(["income", "expense", "transfer", "ignore"]).default("expense"),
  colorSlot: z.number().int().min(1).max(8).optional(),
  icon: z.string().max(40).nullable().optional(),
});

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, parentId, kind, colorSlot, icon } = parsed.data;

  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const [created] = await db
    .insert(schema.categories)
    .values({
      userId,
      parentId: parentId ?? null,
      name,
      slug: `${slug}-${Date.now().toString(36)}`, // user slugs only need to be unique per user, not meaningful
      kind,
      colorSlot: colorSlot ?? 1,
      icon: icon ?? null,
    })
    .returning();

  return NextResponse.json({ category: created });
}
