import { Text, type TextProps } from "react-native";
import { formatCents } from "@tally/core/money";
import { usePrivacy } from "@/lib/PrivacyContext";

interface MoneyTextProps extends TextProps {
  cents: number;
  signed?: boolean;
  abbreviate?: boolean;
  /** Tailwind text-color className, e.g. "text-positive" -- caller decides sign coloring per DESIGN.md §5.4. */
  className?: string;
  /** Opt out of the "hide amounts" mask. The toggle covers exactly four
   * things, same as web's `.money` class (apps/web/app/globals.css): net
   * worth (incl. FIRE's "invested today"), income (the Overview tile and
   * income schedules), investment totals (portfolio value/invested/return,
   * account subtotals, the Overview tile), and account balances. Everything else -- spend,
   * transactions, budgets, bills, individual holdings, FIRE targets and
   * projections -- opts out via this prop. Defaults to true. */
  mask?: boolean;
}

// Every numeral in the app goes through this -- MOBILE_DESIGN.md §3.3's
// tabular-figure rule has no CSS-cascade equivalent in RN, so it has to be a
// shared component rather than an ambient style. Defaults to font-ui (Inter,
// the vast majority of call sites -- list rows, meter-bar totals, inline
// figures), but a caller rendering a hero/display number passes
// `className="font-display ..."` (DESIGN.md §4: Instrument Serif is for
// display numbers only, never a table). Guarding on that rather than just
// concatenating both classes -- NativeWind resolves two conflicting
// font-family utilities by generated-stylesheet order, not by string
// position, so blindly prepending "font-ui" risked silently overriding an
// explicit font-display every time.
export function MoneyText({ cents, signed, abbreviate, className, style, mask = true, ...props }: MoneyTextProps) {
  const { hidden } = usePrivacy();
  // Every number uses the UI family (mobile v2.18.1): a font-display asked
  // for by a caller becomes the bold UI weight, so big figures change size
  // and weight but never typeface. Bricolage stays for titles only.
  const cls = (className ?? "").replace(/\bfont-display\b/g, "font-ui-semibold");
  const hasFontOverride = /font-(mono|ui-medium|ui-semibold|mono-medium)\b/.test(cls);
  return (
    <Text
      className={`${hasFontOverride ? "" : "font-ui"} ${cls}`}
      style={[{ fontVariant: ["tabular-nums"] }, style]}
      {...props}
    >
      {mask && hidden ? "••••••" : formatCents(cents, { signed, abbreviate })}
    </Text>
  );
}
