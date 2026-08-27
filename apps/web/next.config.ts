import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tally/core"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.plaid.com" },
      { protocol: "https", hostname: "logo.clearbit.com" },
    ],
  },
};

export default nextConfig;
