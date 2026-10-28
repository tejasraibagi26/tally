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
  // A clear phone tries the app; Windows/Linux go straight to the page. A
  // "Mac" may be an iPad (iPadOS Safari reports macOS), so OpenInApp decides
  // on the device, from whether it has a touchscreen.
  const phone = /iPhone|iPad|iPod|Android/i.test(ua);
  if (!phone && !/Macintosh/i.test(ua)) redirect(to);
  return <OpenInApp to={to} phone={phone} />;
}
