import { useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, TextInput, ActivityIndicator } from "react-native";
import { X, Check, Search, Plus } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCategories, useCreateCategory, type Category } from "@/lib/queries/categories";
import { chartSeries } from "@/theme/colors";
import { useThemeColors } from "@/theme/useThemeColors";
import { useRF } from "@/theme/responsiveFont";
import { Sheet } from "@/components/ui/Sheet";

// Mirrors web's SearchableSelect used in TransactionDetailPanel.tsx for
// category assignment: a search field filters the flat list by name
// (case-insensitive substring match), matching SearchableSelect's own
// filtering behavior.
export function CategoryPickerSheet({
  visible,
  onClose,
  selectedId,
  onSelect,
  categories: categoriesOverride,
  includeUncategorized = true,
  allowCreate = false,
}: {
  visible: boolean;
  onClose: () => void;
  selectedId: string | null;
  onSelect: (categoryId: string | null, categoryName?: string) => void;
  /** Defaults to every category (transaction categorization's use case) --
   * pass a pre-filtered list instead for a narrower picker, e.g. AddBudgetSheet's
   * expense-kind, not-yet-budgeted-this-month subset. */
  categories?: Category[];
  /** The transaction-categorization "Uncategorized" pseudo-item doesn't make
   * sense for a picker where every result must be a real category (e.g.
   * AddBudgetSheet, which always attaches the budget to one). */
  includeUncategorized?: boolean;
  /** Shows a "+ New category" row that creates an expense category inline via
   * POST /api/categories, then selects it -- e.g. AddBudgetSheet, where the
   * user may want to budget a category that doesn't exist yet. Mirrors web's
   * AddBudgetForm.tsx "+ New category" option. */
  allowCreate?: boolean;
}) {
  const colors = useThemeColors();
  const rf = useRF();
  const { colorScheme } = useColorScheme();
  const series = colorScheme === "dark" ? chartSeries.dark : chartSeries.light;
  const { data } = useCategories();
  const categories = categoriesOverride ?? data?.categories ?? [];
  const [query, setQuery] = useState("");
  const createCategory = useCreateCategory();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const items = useMemo(() => {
    const all = includeUncategorized ? [{ id: null as string | null, name: "Uncategorized", colorSlot: 0 }, ...categories] : categories;
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query, includeUncategorized]);

  function handleClose() {
    setQuery("");
    setCreating(false);
    setNewName("");
    onClose();
  }

  async function submitNewCategory() {
    const name = newName.trim();
    if (!name || createCategory.isPending) return;
    try {
      const { category } = await createCategory.mutateAsync({ name, kind: "expense" });
      onSelect(category.id, category.name);
      handleClose();
    } catch {
      // leave creating mode open with the typed name so the user can retry
    }
  }

  return (
    <Sheet visible={visible} onClose={handleClose} maxHeight="80%">
      {/* Keyboard avoidance now lives in Sheet.tsx itself, around the sheet's outer
          positioning -- a KeyboardAvoidingView here, nested inside the already-positioned
          sheet, couldn't move it above the keyboard. */}
      <>
        <View className="flex-row items-center justify-between px-5 pt-1 pb-3">
          <Text className="font-ui-semibold text-text" style={{ fontSize: rf(18) }}>Category</Text>
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
            className="flex-1 font-ui text-text"
            style={{ fontSize: rf(14.5) }}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X size={15} color={colors["text-3"]} />
            </Pressable>
          )}
        </View>
        {allowCreate && (
          creating ? (
            <View className="mx-5 mb-2 flex-row items-center gap-2">
              <TextInput
                autoFocus
                value={newName}
                onChangeText={setNewName}
                placeholder="New category name"
                placeholderTextColor={colors["text-3"]}
                onSubmitEditing={submitNewCategory}
                returnKeyType="done"
                className="flex-1 rounded-control bg-surface-2 px-3.5 font-ui text-text"
                style={{ height: 42, fontSize: rf(14.5) }}
              />
              <Pressable
                onPress={submitNewCategory}
                disabled={!newName.trim() || createCategory.isPending}
                className="rounded-control bg-brand items-center justify-center px-4 disabled:opacity-50"
                style={{ height: 42 }}
              >
                {createCategory.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text className="font-ui-semibold text-on-brand" style={{ fontSize: rf(14) }}>Add</Text>
                )}
              </Pressable>
              <Pressable onPress={() => { setCreating(false); setNewName(""); }} hitSlop={8}>
                <X size={18} color={colors["text-3"]} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setCreating(true)} className="flex-row items-center gap-2.5 px-5 py-3">
              <Plus size={16} color={colors.brand} />
              <Text className="font-ui text-brand" style={{ fontSize: rf(15) }}>New category</Text>
            </Pressable>
          )
        )}
        <FlatList
          data={items}
          keyExtractor={(item) => item.id ?? "uncategorized"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={<Text className="font-ui text-text-3 px-5 py-6" style={{ fontSize: rf(14) }}>No categories match "{query}".</Text>}
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.id, item.name);
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
                  <Text className="font-ui text-text" style={{ fontSize: rf(15) }}>{item.name}</Text>
                </View>
                {selected && <Check size={18} color={colors.brand} />}
              </Pressable>
            );
          }}
        />
      </>
    </Sheet>
  );
}
