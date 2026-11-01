import { redirect } from "next/navigation";

/** Early retirement moved into Goals (web v2.13.0); old links and bookmarks land there. */
export default async function FirePage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  const { start } = await searchParams;
  redirect(start === "zero" ? "/goals?view=retirement&start=zero" : "/goals?view=retirement");
}
