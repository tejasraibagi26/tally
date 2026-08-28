import { View, Text } from "react-native";
import { CircleCheck, TriangleAlert } from "lucide-react-native";
import type { ItemBadge } from "@/lib/queries/accounts";

// DESIGN.md §5.3 -- status colors are fixed in both themes, never reused as
// a series color; always ship with an icon + label, never color alone.
const config: Record<ItemBadge, { bg: string; fg: string; label: string; Icon: typeof CircleCheck }> = {
  good: { bg: "#E3F0EA", fg: "#0F7A57", label: "Fresh", Icon: CircleCheck },
  warning: { bg: "#F5EEDC", fg: "#8A5A00", label: "Stale", Icon: TriangleAlert },
  serious: { bg: "#F5EEDC", fg: "#8A5A00", label: "Needs sync", Icon: TriangleAlert },
  critical: { bg: "#F6E7E4", fg: "#D03B3B", label: "Needs attention", Icon: TriangleAlert },
  syncing: { bg: "#E5EEFA", fg: "#2A78D6", label: "Syncing", Icon: CircleCheck },
};

export function StatusChip({ status }: { status: ItemBadge }) {
  const c = config[status];
  return (
    <View className="flex-row items-center gap-1" style={{ backgroundColor: c.bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 11 }}>
      <c.Icon size={10} color={c.fg} strokeWidth={2.5} />
      <Text className="font-ui-semibold text-[11.5px]" style={{ color: c.fg }}>
        {c.label}
      </Text>
    </View>
  );
}
