import { Text, type TextProps } from "react-native";
import { formatCents } from "@tally/core/money";
import { usePrivacy } from "@/lib/PrivacyContext";

interface MoneyTextProps extends TextProps {
  cents: number;
  signed?: boolean;
  abbreviate?: boolean;
  /** Tailwind text-color className, e.g. "text-positive" -- caller decides sign coloring per DESIGN.md §5.4. */
  className?: string;
  /** Opt out of the "hide amounts" mask. The toggle is meant to cover figures
   * that reveal overall financial standing at a glance -- net worth, account
   * balances, portfolio value/gain, FIRE numbers -- not every individual
   * dollar figure in the app. Budgets/Subscriptions totals (plans, not
   * balances) and per-line-item amounts (a single transaction, split, or
   * holding) opt out via this prop. Defaults to true. */
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
  const hasFontOverride = /font-(display|mono|ui-medium|ui-semibold|mono-medium)\b/.test(className ?? "");
  return (
    <Text
      className={`${hasFontOverride ? "" : "font-ui"} ${className ?? ""}`}
      style={[{ fontVariant: ["tabular-nums"] }, style]}
      {...props}
    >
      {mask && hidden ? "••••••" : formatCents(cents, { signed, abbreviate })}
    </Text>
  );
}
