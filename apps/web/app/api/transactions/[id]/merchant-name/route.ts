import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { getMerchantRename, setMerchantRename } from "@/lib/merchantRenames";

const bodySchema = z.object({
  // Null or blank goes back to the name sync would show on its own.
  displayName: z.string().max(80).nullable(),
});

// "Rename merchant" from the transaction panel/sheet. A rename covers every
// synced transaction with the same original merchant name, now and on
// future syncs (lib/merchantRenames.ts). Manual rows have no Plaid merchant
// to rename -- their label is the user's already -- so they 404 here.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const rename = await getMerchantRename(userId, id);
  if (!rename) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rename);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await setMerchantRename(userId, id, parsed.data.displayName);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
