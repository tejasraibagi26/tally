"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A merchant's logo (Plaid's, resolved server-side by lib/merchantLogos.ts)
 * in the rounded tile rows already use, falling back to the name's first
 * letter when there's no logo or it fails to load. A plain lazy <img>, not
 * next/image: these are small CDN PNGs and the optimizer would only spend
 * quota on them.
 */
export function MerchantAvatar({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showLogo = logoUrl && !failed;
  return (
    <span className={cn("flex-none flex items-center justify-center overflow-hidden bg-sunken text-text-2 font-medium", className)}>
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
