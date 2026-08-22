import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);

  if (existing) {
    await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, existing.id));
    console.log(`Updated password for existing user ${email}.`);
  } else {
    await db.insert(schema.users).values({ email, passwordHash });
    console.log(`Created user ${email}.`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
