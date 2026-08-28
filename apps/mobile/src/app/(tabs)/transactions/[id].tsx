import { useEffect, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, Pressable, TextInput, Switch, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { X, ChevronRight, Trash2, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { prettifyPfc } from "@tally/core/pfc";
import { MoneyText } from "@/components/ui/MoneyText";
import { useTransaction, useUpdateTransaction, useDeleteTransaction } from "@/lib/queries/transactions";
import { useCategories } from "@/lib/queries/categories";
import { amountColor } from "@/lib/amountColor";
import { CategoryPickerSheet } from "@/components/CategoryPickerSheet";
import { useThemeColors } from "@/theme/useThemeColors";

// MOBILE_DESIGN.md §5.4 -- the web side panel's mobile equivalent, now with
// the same core edit surface as TransactionDetailPanel.tsx: category,
// notes, reviewed, excluded-from-budget, delete. Tags, splits, and
// "always categorize this merchant" preview are deferred -- a smaller,
// genuinely-useful v1 rather than a 1:1 port of every field.
export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { data: t, isLoading } = useTransaction(id);
  const { data: categoriesData } = useCategories();
  const updateTransaction = useUpdateTransaction(id ?? "");
  const deleteTransaction = useDeleteTransaction(id ?? "");

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!t) return;
    setCategoryId(t.categoryId);
    setNotes(t.notes ?? "");
    setReviewed(t.reviewed);
    setExcluded(t.excludedFromBudget);
    setDirty(false);
  }, [t]);

  const currentCategory = categoriesData?.categories.find((c) => c.id === categoryId);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  async function save() {
    await updateTransaction.mutateAsync({ categoryId, notes: notes.trim() || null, reviewed, excluded });
    setDirty(false);
  }

  function confirmDelete() {
    Alert.alert("Delete transaction?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteTransaction.mutateAsync();
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 bg-canvas" style={{ paddingTop: insets.top + 12 }}>
      <Stack.Screen options={{ presentation: "modal" }} />
      <View className="flex-row items-center justify-between px-5 pb-4">
        <Text className="font-ui-semibold text-[18px] text-text">Transaction</Text>
        <View className="flex-row items-center gap-4">
          {t && (
            <Pressable onPress={confirmDelete} hitSlop={12}>
              <Trash2 size={20} color={colors.negative} />
            </Pressable>
          )}
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <X size={22} color={colors["text-2"]} />
          </Pressable>
        </View>
      </View>

      {isLoading || !t ? (
        <ActivityIndicator className="mt-8" />
      ) : (
        <>
          <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingBottom: dirty ? 24 : insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
            <View className="gap-1.5">
              <MoneyText cents={t.amount} signed mask={false} className="font-display text-[36px]" style={{ color: amountColor(t.amount, colors) }} />
              <Text className="font-ui-semibold text-[16px] text-text">{t.merchantName ?? t.name}</Text>
              <Text className="font-ui text-[13.5px] text-text-2">
                {new Date(t.postedDate + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}
              </Text>
            </View>

            <View className="gap-3 pt-2" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
              {t.accountName && <DetailRow label="Account" value={`${t.accountName}${t.accountMask ? ` ····${t.accountMask}` : ""}`} />}
              <DetailRow label="Status" value={t.isPending ? "Pending" : "Posted"} />
              <DetailRow label="Original description" value={t.name} mono />
              <View className="flex-row items-center justify-between">
                <Text className="font-ui text-[14px] text-text-2">Reviewed</Text>
                <Switch value={reviewed} onValueChange={markDirty(setReviewed)} trackColor={{ true: colors.brand }} />
              </View>
              <View className="flex-row items-center justify-between">
                <Text className="font-ui text-[14px] text-text-2">Exclude from budget</Text>
                <Switch value={excluded} onValueChange={markDirty(setExcluded)} trackColor={{ true: colors.brand }} />
              </View>
            </View>

            <View className="gap-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text className="font-ui-semibold text-[12px] text-text-2" style={{ textTransform: "uppercase" }}>
                Category
              </Text>
              <Pressable
                onPress={() => setPickerOpen(true)}
                className="flex-row items-center justify-between h-12 rounded-control bg-surface-2 px-[14px]"
              >
                <Text className="font-ui text-[14.5px] text-text">{currentCategory?.name ?? (categoryId ? prettifyPfc(t.pfcDetailed) : "Uncategorized")}</Text>
                <ChevronRight size={16} color={colors["text-3"]} />
              </Pressable>
            </View>

            <View className="gap-2">
              <Text className="font-ui-semibold text-[12px] text-text-2" style={{ textTransform: "uppercase" }}>
                Note
              </Text>
              <TextInput
                value={notes}
                onChangeText={markDirty(setNotes)}
                placeholder="Add a note…"
                placeholderTextColor={colors["text-3"]}
                multiline
                numberOfLines={3}
                className="rounded-control bg-surface-2 px-[14px] py-3 font-ui text-[14px] text-text"
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </View>

            {t.splits.length > 0 && (
              <View className="gap-2 pt-2" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text className="font-ui-semibold text-[12px] text-text-2" style={{ textTransform: "uppercase" }}>
                  Split
                </Text>
                {t.splits.map((s, i) => (
                  <View key={i} className="flex-row justify-between">
                    <Text className="font-ui text-[14px] text-text">{s.note ?? "Split"}</Text>
                    <MoneyText cents={s.amount} mask={false} className="text-[14px] text-text" />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {dirty && (
            <View className="px-5 pt-3" style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }}>
              <Pressable
                onPress={save}
                disabled={updateTransaction.isPending}
                className="rounded-full bg-brand flex-row items-center justify-center gap-2 active:opacity-90 disabled:opacity-50"
                style={{ height: 52 }}
              >
                {updateTransaction.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={17} color="#FFFFFF" strokeWidth={2.5} />
                    <Text className="font-ui-semibold text-[15px] text-on-brand">Save changes</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          <CategoryPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} selectedId={categoryId} onSelect={markDirty(setCategoryId)} />
        </>
      )}
    </KeyboardAvoidingView>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View className="flex-row justify-between">
      <Text className="font-ui text-[14px] text-text-2">{label}</Text>
      <Text className="font-ui text-[14px] text-text" style={mono ? { fontFamily: "JetBrainsMono", fontSize: 12.5 } : undefined}>
        {value}
      </Text>
    </View>
  );
}
