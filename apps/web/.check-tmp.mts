import "dotenv/config";
import postgres from "postgres";
const s = postgres(process.env.DATABASE_URL!, { prepare: false });
const r = await s`select to_regclass('public.merchant_renames') as t`;
console.log("table:", r[0].t);
await s.end();
