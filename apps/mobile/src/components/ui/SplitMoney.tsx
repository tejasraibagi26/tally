import { Text } from "react-native";
import { formatCents } from "@tally/core/money";
import { usePrivacy } from "@/lib/PrivacyContext";
import { useRF } from "@/theme/responsiveFont";

/**
 * A display-size amount (serif) whose cents render at a smaller, muted size
 * so the dollars carry the figure. Same privacy-mask contract as MoneyText.
 */
export function SplitMoney({
  cents,
  mask = true,
  size,
  centsSize,
  lineHeight,
  accessibilityLabel,
}: {
  cents: number;
  mask?: boolean;
  size: number;
  centsSize: number;
  lineHeight: number;
  accessibilityLabel?: string;
}) {
  const { hidden } = usePrivacy();
  const rf = useRF();
  const masked = mask && hidden;
  const text = formatCents(cents);
  const dot = text.lastIndexOf(".");
  const whole = dot === -1 ? text : text.slice(0, dot);
  const frac = dot === -1 ? "" : text.slice(dot);
  return (
    <Text
      className="font-display text-text"
      style={{ fontSize: rf(size), lineHeight: rf(lineHeight), fontVariant: ["tabular-nums"] }}
      numberOfLines={1}
      adjustsFontSizeToFit
      accessibilityLabel={masked ? "Amount hidden" : accessibilityLabel ?? text}
    >
      {masked ? "••••••" : whole}
      {!masked && <Text className="font-display text-text-3" style={{ fontSize: rf(centsSize) }}>{frac}</Text>}
    </Text>
  );
}
