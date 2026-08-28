import { View, Text } from "react-native";
import { CircleCheck, TriangleAlert } from "lucide-react-native";
import type { ItemBadge } from "@/lib/queries/accounts";
import { useThemeColors } from "@/theme/useThemeColors";

// DESIGN.md §5.3 -- status colors are fixed in both themes, never reused as
// a series color; always ship with an icon + label, never color alone. The
// *-subtle/status-* tokens below are still scheme-reactive (via
// useThemeColors) even though the underlying meaning is fixed, so the chip
// doesn't read as a blown-out light patch against a dark surface.
function configFor(colors: ReturnType<typeof useThemeColors>): Record<ItemBadge, { bg: string; fg: string; label: string; Icon: typeof CircleCheck }> {
  return {
    good: { bg: colors["positive-subtle"], fg: colors.positive, label: "Fresh", Icon: CircleCheck },
    warning: { bg: colors["warning-subtle"], fg: colors.warning, label: "Stale", Icon: TriangleAlert },
    serious: { bg: colors["warning-subtle"], fg: colors.warning, label: "Needs sync", Icon: TriangleAlert },
    critical: { bg: colors["negative-subtle"], fg: colors.negative, label: "Needs attention", Icon: TriangleAlert },
    syncing: { bg: colors["info-subtle"], fg: colors.info, label: "Syncing", Icon: CircleCheck },
  };
}

export function StatusChip({ status }: { status: ItemBadge }) {
  const colors = useThemeColors();
  const c = configFor(colors)[status];
  return (
    <View className="flex-row items-center gap-1" style={{ backgroundColor: c.bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 11 }}>
      <c.Icon size={10} color={c.fg} strokeWidth={2.5} />
      <Text className="font-ui-semibold text-[11.5px]" style={{ color: c.fg }}>
        {c.label}
      </Text>
    </View>
  );
}
