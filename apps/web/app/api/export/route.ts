import { NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// §10 GET /api/export?format=csv|json&from&to — a full data export, not a
// paginated view; capped at 20k rows so a pathological range can't hang the
// request (WORK.md §2's scale is 300–2,000 tx/month, so this is generous).
const MAX_ROWS = 20_000;

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "json" ? "json" : "csv";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const conditions = [eq(schema.transactions.userId, userId)];
  if (from) conditions.push(gte(schema.transactions.postedDate, from));
  if (to) conditions.push(lte(schema.transactions.postedDate, to));

  const rows = await db
    .select({
      postedDate: schema.transactions.postedDate,
      name: schema.transactions.name,
      merchantName: schema.transactions.merchantName,
      amount: schema.transactions.amount,
      currency: schema.transactions.currency,
      accountName: schema.accounts.name,
      accountMask: schema.accounts.mask,
      categoryName: schema.categories.name,
      isPending: schema.transactions.isPending,
      isTransfer: schema.transactions.isTransfer,
      notes: schema.transactions.notes,
      tags: schema.transactions.tags,
    })
    .from(schema.transactions)
    .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
    .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
    .where(and(...conditions))
    .orderBy(desc(schema.transactions.postedDate))
    .limit(MAX_ROWS);

  const filenameRange = from || to ? `_${from ?? "start"}_${to ?? "end"}` : "";

  if (format === "json") {
    return new NextResponse(JSON.stringify({ transactions: rows }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="tally-transactions${filenameRange}.json"`,
      },
    });
  }

  const header = ["Date", "Merchant", "Description", "Amount", "Currency", "Account", "Category", "Pending", "Transfer", "Notes", "Tags"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.postedDate,
        csvEscape(r.merchantName ?? ""),
        csvEscape(r.name),
        (r.amount / 100).toFixed(2),
        r.currency,
        csvEscape(`${r.accountName} ····${r.accountMask ?? "----"}`),
        csvEscape(r.categoryName ?? ""),
        r.isPending ? "true" : "false",
        r.isTransfer ? "true" : "false",
        csvEscape(r.notes ?? ""),
        csvEscape(r.tags.join("; ")),
      ].join(","),
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="tally-transactions${filenameRange}.csv"`,
    },
  });
}
