import { auth } from "@/lib/auth";

/** Throws if unauthenticated. Every API route that touches user data calls this first. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error("UNAUTHENTICATED");
  return userId;
}
