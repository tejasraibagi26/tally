import { Pressable, Text } from "react-native";
import { BusyLabel } from "@/components/ui/BusyIcon";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";

export type PillVariant = "primary" | "subtle" | "secondary" | "plain";
export type PillSize = "lg" | "md" | "sm";

// Three heights, by place (mobile's take on DESIGN.md §8 "size by place"):
// lg ends a sheet or a sign-in form, md is a full-width action inside a
// screen or card, sm sits inline in a row or header.
const HEIGHT: Record<PillSize, number> = { lg: 52, md: 48, sm: 36 };
const FONT: Record<PillSize, number> = { lg: 15, md: 14.5, sm: 13 };
const PAD_X: Record<PillSize, number> = { lg: 24, md: 20, sm: 16 };

/**
 * Mobile's one button. Busy shows a spinner beside the label, which stays,
 * at a fixed size -- never a bare spinner in place of the label (DESIGN.md
 * §8). Pop Calm (mobile v2.18.0): no ink outline; still a full pill. Full width unless
 * `inline`, which sizes to the label.
 */
export function PillButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  size = "lg",
  inline = false,
  className,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: PillVariant;
  size?: PillSize;
  inline?: boolean;
  className?: string;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const fg =
    variant === "primary" ? colors["on-brand"]! : variant === "subtle" ? colors.brand! : variant === "secondary" ? colors.text! : colors["text-2"]!;
  const look =
    variant === "primary"
      ? "bg-brand border-button border-ink"
      : variant === "subtle"
        ? "bg-brand-subtle border-button border-ink"
        : variant === "secondary"
          ? "bg-surface-2 border border-border"
          : "";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      className={`rounded-full flex-row items-center justify-center active:opacity-90 ${inline && !/\bself-/.test(className ?? "") ? "self-start" : ""} ${look} ${className ?? ""}`}
      style={{ height: HEIGHT[size], paddingHorizontal: PAD_X[size], opacity: disabled && !loading ? 0.45 : 1 }}
    >
      <BusyLabel busy={loading} color={fg}>
        <Text
          numberOfLines={1}
          className={variant === "plain" ? "font-ui-medium" : "font-ui-semibold"}
          style={{ fontSize: rf(variant === "plain" ? Math.min(14, FONT[size]) : FONT[size]), color: fg, flexShrink: 1 }}
        >
          {label}
        </Text>
      </BusyLabel>
    </Pressable>
  );
}
