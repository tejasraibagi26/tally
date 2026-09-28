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
};

export default nextConfig;
