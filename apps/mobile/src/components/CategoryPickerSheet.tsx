import { Modal, View, Text, Pressable, FlatList } from "react-native";
import { X, Check } from "lucide-react-native";
import { useCategories } from "@/lib/queries/categories";
import { chartSeries } from "@/theme/colors";

// Mirrors web's SearchableSelect used in TransactionDetailPanel.tsx for
// category assignment -- a flat list rather than searchable for v1 (the
// category count is small enough that scrolling is fine; a search field is
// a reasonable follow-up if the list grows).
export function CategoryPickerSheet({
  visible,
  onClose,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
}) {
  const { data } = useCategories();
  const categories = data?.categories ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1" style={{ backgroundColor: "rgba(26,25,23,0.4)" }} onPress={onClose} />
      <View className="bg-canvas rounded-t-panel" style={{ maxHeight: "75%" }}>
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
          <Text className="font-ui-semibold text-[18px] text-text">Category</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X size={22} color="#524F47" />
          </Pressable>
        </View>
        <FlatList
          data={[{ id: null, name: "Uncategorized", colorSlot: 0 }, ...categories]}
          keyExtractor={(item) => item.id ?? "uncategorized"}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
                className="flex-row items-center justify-between px-5 py-3.5"
              >
                <View className="flex-row items-center gap-2.5">
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: item.colorSlot ? chartSeries.light[(item.colorSlot - 1) % 8] : "#948F84",
                    }}
                  />
                  <Text className="font-ui text-[15px] text-text">{item.name}</Text>
                </View>
                {selected && <Check size={18} color="#14513F" />}
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
