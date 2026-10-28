import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSafeAppPath } from "@tally/core/appLinks";
import { OpenInApp } from "./OpenInApp";

/**
 * Where email buttons point (/open?to=/subscriptions): on a computer it goes
 * straight to the page; on a phone it tries the app (tally://) and offers
 * the browser as the fallback. Public in middleware.ts: it shows no data
 * and only ever sends you to a same-site path.
 */
export default async function OpenPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const raw = (await searchParams).to;
  const to = isSafeAppPath(raw) ? raw : "/overview";
  const ua = (await headers()).get("user-agent") ?? "";
  if (!/iPhone|iPad|iPod|Android/i.test(ua)) redirect(to);
  return <OpenInApp to={to} />;
}
