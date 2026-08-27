import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// One pooled connection per process. Next.js route handlers and the worker
// each get their own module instance of this file. `prepare: false` is
// required against Neon's pooled connection string (PgBouncer in
// transaction mode doesn't support prepared statements); it's a no-op
// against a direct Postgres connection, so it's safe to leave on always.
const client = postgres(process.env.DATABASE_URL, { max: 10, prepare: false });

export const db = drizzle(client, { schema });
export { schema };
