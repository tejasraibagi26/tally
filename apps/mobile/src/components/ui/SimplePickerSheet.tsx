import { View, Text, Pressable, FlatList } from "react-native";
import { X, Check } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { Sheet } from "@/components/ui/Sheet";

export interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
}

/**
 * A flat-list, no-search picker sheet — the same shell/behavior as
 * CategoryPickerSheet.tsx minus the search field and color dot, for a list
 * short enough (accounts, day-of-month anchors) that search would be
 * overkill. Reach for CategoryPickerSheet itself when the list is long
 * enough to need filtering.
 */
export function SimplePickerSheet({
  visible,
  onClose,
  title,
  items,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: PickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="75%">
      <View className="flex-row items-center justify-between px-5 pt-1 pb-3">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <X size={22} color={colors["text-2"]} />
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text className="font-ui text-text-3 px-5 py-6" style={{ fontSize: rf(14) }}>Nothing to choose from yet.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              onSelect(item.id);
              onClose();
            }}
            className="flex-row items-center justify-between px-5 py-3.5"
          >
            <View className="gap-0.5">
              <Text className="font-ui text-text" style={{ fontSize: rf(15) }}>{item.label}</Text>
              {item.sublabel && <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>{item.sublabel}</Text>}
            </View>
            {item.id === selectedId && <Check size={18} color={colors.brand} />}
          </Pressable>
        )}
      />
    </Sheet>
  );
}
