import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { generateApiKey } from "@/lib/apiKeyAuth";

// Personal access tokens for automation callers (Apple Shortcuts, etc.) that
// can't do NextAuth's cookie flow or the mobile app's JWT dance -- see
// lib/apiKeyAuth.ts. Managed from Settings; requireUserId here (not
// requireApiKeyUserId) means this management surface itself works from
// either the web session or the mobile app's bearer token, same as every
// other settings API.
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      keyPrefix: schema.apiKeys.keyPrefix,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, userId))
    .orderBy(desc(schema.apiKeys.createdAt));

  return NextResponse.json({ keys });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { key, keyHash, keyPrefix } = generateApiKey();
  const [created] = await db
    .insert(schema.apiKeys)
    .values({ userId, name: parsed.data.name, keyHash, keyPrefix })
    .returning({ id: schema.apiKeys.id, name: schema.apiKeys.name, keyPrefix: schema.apiKeys.keyPrefix, createdAt: schema.apiKeys.createdAt });

  // The only point in this key's life the raw value is ever available --
  // the response includes it once, the row from here on only holds its hash.
  return NextResponse.json({ apiKey: created, key }, { status: 201 });
}
