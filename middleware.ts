import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-runtime middleware: only the provider-less config, so bcrypt/postgres
// (Node-only) never get bundled here. Real authorization happens per-request
// in route handlers and server components via lib/auth.ts.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // "|$" excludes the bare root path — it's the public marketing homepage
  // (app/page.tsx), which does its own auth check and redirects signed-in
  // users to /overview itself. "docs" and "privacy" are public pages with
  // no user data — no auth check needed. Every other route stays gated here.
  matcher: ["/((?!api/auth|api/plaid/webhook|login|docs|privacy|_next/static|_next/image|favicon.ico|$).*)"],
};
