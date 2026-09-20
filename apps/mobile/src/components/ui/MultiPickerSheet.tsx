import { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { Check, X } from "lucide-react-native";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { Sheet } from "@/components/ui/Sheet";
import type { PickerItem } from "@/components/ui/SimplePickerSheet";

/**
 * Multi-select sibling of SimplePickerSheet: tapping a row toggles it
 * instead of closing the sheet, and a "Done" button at the bottom commits
 * the draft selection -- SimplePickerSheet's single-select "tap and close"
 * flow doesn't fit picking several. Same shell/list styling otherwise.
 */
export function MultiPickerSheet({
  visible,
  onClose,
  title,
  items,
  selectedIds,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: PickerItem[];
  selectedIds: string[];
  onApply: (ids: string[]) => void;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const [draft, setDraft] = useState<string[]>(selectedIds);

  // Re-seed the draft from the committed selection each time the sheet
  // opens, same as TransactionFiltersSheet's own draft pattern -- otherwise
  // a cancelled-out-of edit would stick around the next time it's reopened.
  useEffect(() => {
    if (visible) setDraft(selectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function toggle(id: string) {
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  }

  return (
    <Sheet visible={visible} onClose={onClose} maxHeight="80%">
      <View className="flex-row items-center justify-between px-5 pt-1 pb-3">
        <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>{title}</Text>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          className="items-center justify-center rounded-full bg-surface-2"
          style={{ width: 36, height: 36 }}
        >
          <X size={18} color={colors.text} strokeWidth={2} />
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
        ListEmptyComponent={<Text className="font-ui text-text-3 px-5 py-6" style={{ fontSize: rf(14) }}>Nothing to choose from yet.</Text>}
        renderItem={({ item }) => (
          <Pressable onPress={() => toggle(item.id)} className="flex-row items-center justify-between px-5 py-3.5">
            <View className="gap-0.5">
              <Text className="font-ui text-text" style={{ fontSize: rf(15) }}>{item.label}</Text>
              {item.sublabel && <Text className="font-ui text-text-3" style={{ fontSize: rf(12.5) }}>{item.sublabel}</Text>}
            </View>
            {draft.includes(item.id) && <Check size={18} color={colors.brand} />}
          </Pressable>
        )}
      />
      <View className="px-5 pt-2" style={{ paddingBottom: 24 }}>
        <Pressable
          onPress={() => {
            onApply(draft);
            onClose();
          }}
          className="h-12 rounded-full bg-brand items-center justify-center active:opacity-90"
        >
          <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14.5) }}>
            {draft.length > 0 ? `Done (${draft.length})` : "Done"}
          </Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
