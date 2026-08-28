import { useMemo, useState } from "react";
import { Modal, View, Text, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { X, Check, Search } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCategories } from "@/lib/queries/categories";
import { chartSeries } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";

// Mirrors web's SearchableSelect used in TransactionDetailPanel.tsx for
// category assignment: a search field filters the flat list by name
// (case-insensitive substring match), matching SearchableSelect's own
// filtering behavior.
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
  const colors = useThemeColors();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const { data } = useCategories();
  const categories = data?.categories ?? [];
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const all = [{ id: null as string | null, name: "Uncategorized", colorSlot: 0 }, ...categories];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  function handleClose() {
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable className="flex-1" style={{ backgroundColor: "rgba(26,25,23,0.4)" }} onPress={handleClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="bg-canvas rounded-t-panel" style={{ maxHeight: "75%" }}>
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
          <Text className="font-ui-semibold text-[18px] text-text">Category</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <X size={22} color={colors["text-2"]} />
          </Pressable>
        </View>
        <View className="mx-5 mb-2 flex-row items-center gap-2 rounded-control bg-surface-2 px-3.5" style={{ height: 42 }}>
          <Search size={16} color={colors["text-3"]} strokeWidth={2} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search categories"
            placeholderTextColor={colors["text-3"]}
            autoCapitalize="none"
            autoCorrect={false}
            className="flex-1 font-ui text-[14.5px] text-text"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X size={15} color={colors["text-3"]} />
            </Pressable>
          )}
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id ?? "uncategorized"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={<Text className="font-ui text-[14px] text-text-3 px-5 py-6">No categories match "{query}".</Text>}
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.id);
                  handleClose();
                }}
                className="flex-row items-center justify-between px-5 py-3.5"
              >
                <View className="flex-row items-center gap-2.5">
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: item.colorSlot ? series[(item.colorSlot - 1) % 8] : colors["text-3"],
                    }}
                  />
                  <Text className="font-ui text-[15px] text-text">{item.name}</Text>
                </View>
                {selected && <Check size={18} color={colors.brand} />}
              </Pressable>
            );
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}
