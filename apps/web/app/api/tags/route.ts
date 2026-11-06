import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { tagsFor } from "@/lib/tags";

/** Every tag with its count, net spend and dates (lib/tags.ts). */
async function GET_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ tags: await tagsFor(userId) });
}

export const GET = route(GET_handler);
