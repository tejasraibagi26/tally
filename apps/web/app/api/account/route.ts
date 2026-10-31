import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { verifyCurrentPassword } from "@/lib/authenticateCredentials";
import { RATE_LIMITED_MESSAGE } from "@/lib/rateLimit";
import { sendEmailChangeEmails } from "@/lib/emailChange";

const bodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  currentPassword: z.string().min(1),
});

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    // uiLook: the Tally Pop flag (lib/uiLook.ts) -- the mobile app has no
    // link to open, so it reads the account copy /labs/pop writes.
    // seenAnnouncements: one-time modals already dismissed (lib/announcements.ts).
    .select({ name: schema.users.name, email: schema.users.email, birthDate: schema.users.birthDate, recapsEnabled: schema.users.recapsEnabled, uiLook: schema.users.uiLook, seenAnnouncements: schema.users.seenAnnouncements })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(user);
}

// Updates name/birthDate, and starts an email change. Email is the login
// identifier, so it (like a password change) requires the current password
// — this isn't a "add a field" form. birthDate isn't sensitive on its own, but it's bundled into
// this same password-gated form rather than a separate one, same as name.
export async function PATCH(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { name, email, birthDate, currentPassword } = parsed.data;

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await verifyCurrentPassword(userId, user.passwordHash, currentPassword, req);
  if (valid === "rate_limited") {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  await db
    .update(schema.users)
    .set({ name: name || null, ...(birthDate !== undefined ? { birthDate } : {}) })
    .where(eq(schema.users.id, userId));

  // The email itself only changes once the new address confirms
  // (lib/emailChange.ts), so a hijacked session can't quietly move the
  // login somewhere the owner never sees. The old address is told too.
  let emailChangePending = false;
  if (email !== user.email) {
    const [taken] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (taken) return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    const appUrl = process.env.APP_URL;
    if (!appUrl) return NextResponse.json({ error: "APP_URL not configured" }, { status: 500 });
    try {
      await sendEmailChangeEmails({ appUrl, userId, fromEmail: user.email, toEmail: email });
    } catch (err) {
      console.error("email change: sending the confirm link failed", err);
      return NextResponse.json({ error: "Couldn't send the confirmation email. Try again." }, { status: 502 });
    }
    emailChangePending = true;
  }

  // emailChanged stays false: nothing about the session's email has moved
  // yet (older mobile builds read it to decide whether to sign out).
  return NextResponse.json({ ok: true, emailChanged: false, emailChangePending });
}
