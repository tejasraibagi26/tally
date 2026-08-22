import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

const bodySchema = z.object({
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email(),
  currentPassword: z.string().min(1),
});

// Updates name/email. Email is the login identifier, so it (like a password
// change) requires the current password — this isn't a "add a field" form.
export async function PATCH(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { name, email, currentPassword } = parsed.data;

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  try {
    await db
      .update(schema.users)
      .set({ name: name || null, email })
      .where(eq(schema.users.id, userId));
  } catch (err) {
    // Unique constraint on email.
    console.error("account update failed", err);
    return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
  }

  const emailChanged = email !== user.email;
  return NextResponse.json({ ok: true, emailChanged });
}
