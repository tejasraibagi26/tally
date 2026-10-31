import { execSync } from "node:child_process";
import type { NextConfig } from "next";

// Resolved once, at build time (this file runs in Node, never in the
// browser) -- Vercel always sets VERCEL_GIT_COMMIT_SHA for a deployment
// build regardless of any "expose system env vars" project setting, so
// that's checked first and is what production actually uses; the local
// `git` fallback is only for `next dev`/a non-Vercel build. lib/version.ts
// reads the result back out of NEXT_PUBLIC_BUILD_SHA, which *is* inlined
// into the client bundle (unlike the source env vars above).
function resolveBuildSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  transpilePackages: ["@tally/core"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.plaid.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
    ],
  },
  env: {
    NEXT_PUBLIC_BUILD_SHA: resolveBuildSha(),
  },
  // Baseline hardening on every response, static files included. The CSP
  // here is only for API routes: pages get theirs from middleware.ts, with
  // a per-request nonce -- and on Vercel a CSP set here for a page reaches
  // the render as its request header in place of middleware's, so Next.js
  // finds no nonce to stamp its scripts with. Both policies agree on the
  // rest: no framing (clickjacking), no <base> hijack, no plugins, forms
  // only post back to this origin.
  async headers() {
    const shared = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      { source: "/:path*", headers: shared },
      {
        source: "/api/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" }],
      },
    ];
  },
};

export default nextConfig;
