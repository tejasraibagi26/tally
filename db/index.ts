import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// One pooled connection per process. Next.js route handlers and the worker
// each get their own module instance of this file.
const client = postgres(process.env.DATABASE_URL, { max: 10 });

export const db = drizzle(client, { schema });
export { schema };
