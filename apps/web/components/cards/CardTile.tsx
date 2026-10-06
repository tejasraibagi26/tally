import type { CardNetwork } from "@tally/core/cardView";
import { isDarkBrandColor } from "@tally/core/cardView";
import { cn } from "@/lib/cn";

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0]![0]! + words[1]![0]! : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** Simple network marks, drawn unaltered at a fixed aspect; no network fetch. */
export function NetworkMark({ network, light, className }: { network: CardNetwork; light: boolean; className?: string }) {
  if (network === "mastercard") {
    return (
      <svg viewBox="0 0 26 16" className={className} aria-label="Mastercard" role="img">
        <circle cx="8" cy="8" r="8" fill="#EB001B" />
        <circle cx="18" cy="8" r="8" fill="#F79E1B" fillOpacity="0.9" />
      </svg>
    );
  }
  if (network === "amex") {
    return (
      <svg viewBox="0 0 34 14" className={className} aria-label="American Express" role="img">
        <rect width="34" height="14" rx="2" fill="#2E77BC" />
        <text x="17" y="10.2" textAnchor="middle" fontSize="8.5" fontWeight="800" fontFamily="Arial, Helvetica, sans-serif" fill="#fff" letterSpacing="0.3">
          AMEX
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 36 12" className={className} aria-label="Visa" role="img">
      <text x="18" y="10.5" textAnchor="middle" fontSize="12.5" fontStyle="italic" fontWeight="900" fontFamily="Arial, Helvetica, sans-serif" fill={light ? "#1A1F71" : "#fff"} letterSpacing="0.4">
        VISA
      </text>
    </svg>
  );
}

/**
 * A card-shaped tile in the bank's brand color with its logo (on white, so
 * dark logos stay visible) and the network mark. Every part falls back:
 * no logo shows the bank's initials, no color a neutral tile, an unknown
 * network no mark -- never a broken image or a guess.
 */
export function CardTile({
  bankName,
  color,
  logo,
  network,
  size = "sm",
  mask,
}: {
  bankName: string;
  color: string | null;
  logo: string | null;
  network: CardNetwork | null;
  size?: "sm" | "lg";
  mask?: string | null;
}) {
  const dark = isDarkBrandColor(color);
  const lg = size === "lg";
  return (
    <span
      className={cn(
        "relative flex-none overflow-hidden",
        lg ? "w-[88px] h-[56px] rounded-[9px]" : "w-11 h-[30px] rounded-[6px]",
        !color && "bg-surface-2 border border-border",
        color && !dark && "border border-border",
      )}
      style={color ? { background: color } : undefined}
      aria-label={`${bankName}${network ? ` ${network}` : ""} card`}
      role="img"
    >
      <span
        className={cn(
          "absolute flex items-center justify-center overflow-hidden font-bold",
          lg ? "left-2 top-2 w-[22px] h-[22px] rounded-[5px] text-[9px]" : "left-1 top-1 w-3 h-3 rounded-[3px] text-[6px]",
          logo ? "bg-white" : color ? (dark ? "bg-white/20 text-white" : "bg-black/10 text-text") : "bg-sunken text-text-2",
          !logo && (lg ? "w-auto px-1" : "w-auto px-[3px]"),
        )}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="w-full h-full object-contain" />
        ) : (
          initials(bankName)
        )}
      </span>
      {/* Top-right, across from the logo, so it never meets the network mark at the bottom. */}
      {lg && mask && <span className={cn("absolute right-2 top-2 font-mono text-[9.5px] leading-none", dark ? "text-white/85" : "text-text-2")}>••{mask}</span>}
      {network && <NetworkMark network={network} light={!dark} className={cn("absolute", lg ? "right-2 bottom-2 h-[14px] w-auto" : "right-1 bottom-[3px] h-[8px] w-auto")} />}
    </span>
  );
}
