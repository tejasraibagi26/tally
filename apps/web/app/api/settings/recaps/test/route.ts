import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { sendMonthlyRecapForUser } from "@/lib/sendMonthlyRecap";

const MONTH_RE = /^\d{4}-\d{2}-01$/;
const bodySchema = z.object({ month: z.string().regex(MONTH_RE).optional() });

function currentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * "Send me a test recap" — session-authed (unlike the cron route, which is
 * CRON_SECRET-gated and loops every user), sends only to the caller, and
 * defaults to the CURRENT in-progress month rather than the last completed
 * one, since the point is previewing real numbers on demand. Bypasses
 * checkAlreadySent/checkActivity and doesn't recordSend, so it never
 * interferes with the real monthly cron's idempotency or FIRE-delta state.
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "APP_URL not configured" }, { status: 500 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const month = parsed.data.month ?? currentMonth();

  const [user] = await db.select({ id: schema.users.id, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await sendMonthlyRecapForUser(
      user,
      month,
      { appUrl, companyName: process.env.COMPANY_NAME, companyAddress: process.env.COMPANY_ADDRESS },
      { checkAlreadySent: false, checkActivity: false, recordSend: false },
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error(`Test recap send failed for user ${userId}`, err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Send failed" }, { status: 500 });
  }
}
