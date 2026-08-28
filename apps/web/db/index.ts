import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// One pooled connection per process -- but in `next dev`, this module gets
// re-evaluated on every server-side hot reload, and without a guard each
// reload created a brand-new 10-connection pool without closing the old
// one. Over a long dev session that leaked enough connections to hit
// Postgres's max_connections ("sorry, too many clients already"), failing
// every real request. Stashing the client on `globalThis` survives HMR the
// same way it survives Next.js route handler / worker module instances.
// `prepare: false` is required against Neon's pooled connection string
// (PgBouncer in transaction mode doesn't support prepared statements); it's
// a no-op against a direct Postgres connection, so it's safe to leave on
// always.
const globalForDb = globalThis as unknown as { __pgClient?: ReturnType<typeof postgres> };

const client = globalForDb.__pgClient ?? postgres(process.env.DATABASE_URL, { max: 10, prepare: false });
if (process.env.NODE_ENV !== "production") globalForDb.__pgClient = client;

export const db = drizzle(client, { schema });
export { schema };
